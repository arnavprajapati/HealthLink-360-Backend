import { google } from 'googleapis';
import User from '../models/User.js';
import HealthGoal from '../models/HealthGoal.js';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export const getGoogleAuthUrl = async (req, res) => {
    try {
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
            state: req.user.id 
        });

        res.json({
            success: true,
            url
        });
    } catch (error) {
        console.error('Get Auth URL Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate auth URL'
        });
    }
};

export const googleCallback = async (req, res) => {
    try {
        const { code, state, error } = req.query;
        const userId = state;

        console.log('🔵 Google Callback Received:', { code: !!code, state: userId, error });

        if (error) {
            console.error('❌ OAuth Error from Google:', error);
            return res.redirect(`${process.env.CLIENT_URL}/calendar?error=${error}`);
        }

        if (!code) {
            console.error('❌ No authorization code received');
            return res.redirect(`${process.env.CLIENT_URL}/calendar?error=no_code`);
        }

        if (!userId) {
            console.error('❌ No user ID in state parameter');
            return res.redirect(`${process.env.CLIENT_URL}/calendar?error=invalid_state`);
        }

        const user = await User.findById(userId);
        if (!user) {
            console.error('❌ User not found:', userId);
            return res.redirect(`${process.env.CLIENT_URL}/calendar?error=user_not_found`);
        }

        console.log('🟢 Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('🟢 Tokens received:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiryDate: tokens.expiry_date
        });

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                googleTokens: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    scope: tokens.scope,
                    token_type: tokens.token_type,
                    expiry_date: tokens.expiry_date
                },
                googleCalendarConnected: true
            },
            { new: true }
        );

        console.log('✅ User updated successfully:', {
            userId: updatedUser._id,
            connected: updatedUser.googleCalendarConnected,
            hasTokens: !!updatedUser.googleTokens?.access_token
        });

        res.redirect(`${process.env.CLIENT_URL}/calendar?success=true`);
    } catch (error) {
        console.error('❌ OAuth Callback Error:', error.message);
        console.error('Error Details:', error);
        res.redirect(`${process.env.CLIENT_URL}/calendar?error=auth_failed`);
    }
};

const getCalendarClient = async (userId) => {
    const user = await User.findById(userId);

    if (!user || !user.googleTokens?.access_token) {
        throw new Error('Google Calendar not connected');
    }

    oauth2Client.setCredentials(user.googleTokens);

    if (user.googleTokens.expiry_date && Date.now() >= user.googleTokens.expiry_date) {
        console.log('🔄 Refreshing expired token...');
        const { credentials } = await oauth2Client.refreshAccessToken();

        await User.findByIdAndUpdate(userId, {
            'googleTokens.access_token': credentials.access_token,
            'googleTokens.expiry_date': credentials.expiry_date
        });

        oauth2Client.setCredentials(credentials);
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
};

export const checkConnection = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            connected: user?.googleCalendarConnected || false,
            hasTokens: !!user?.googleTokens?.access_token
        });
    } catch (error) {
        console.error('Check Connection Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check connection status'
        });
    }
};

export const createEvent = async (req, res) => {
    try {
        const { title, description, startDateTime, endDateTime, recurrence, goalId } = req.body;
        const userId = req.user.id;

        if (!title || !startDateTime || !endDateTime) {
            return res.status(400).json({
                success: false,
                message: 'Title, startDateTime, and endDateTime are required'
            });
        }

        const calendar = await getCalendarClient(userId);

        const event = {
            summary: title,
            description: description || `HealthLink-360 Goal: ${title}`,
            start: {
                dateTime: startDateTime,
                timeZone: 'UTC'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'UTC'
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 30 },
                    { method: 'email', minutes: 60 }
                ]
            }
        };

        if (recurrence) {
            event.recurrence = [recurrence];
        }

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });

        const eventId = response.data.id;

        if (goalId) {
            await HealthGoal.findOneAndUpdate(
                { _id: goalId, userId },
                { googleEventId: eventId, syncToGoogleCalendar: true }
            );
        }

        res.json({
            success: true,
            message: 'Event created successfully',
            data: {
                eventId,
                htmlLink: response.data.htmlLink
            }
        });
    } catch (error) {
        console.error('Create Event Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create event'
        });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { eventId } = req.body;
        const userId = req.user.id;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID is required'
            });
        }

        const calendar = await getCalendarClient(userId);

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });

        await HealthGoal.updateMany(
            { userId, googleEventId: eventId },
            { googleEventId: null, syncToGoogleCalendar: false }
        );

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Delete Event Error:', error);

        if (error.code === 404 || error.message?.includes('Not Found')) {
            await HealthGoal.updateMany(
                { userId: req.user.id, googleEventId: req.body.eventId },
                { googleEventId: null, syncToGoogleCalendar: false }
            );

            return res.json({
                success: true,
                message: 'Event already deleted or not found'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete event'
        });
    }
};

export const getSyncedEvents = async (req, res) => {
    try {
        const userId = req.user.id;

        const goals = await HealthGoal.find({
            userId,
            googleEventId: { $ne: null }
        }).select('parameter customParameterName googleEventId trackingFrequency deadline createdAt');

        res.json({
            success: true,
            data: goals.map(goal => ({
                goalId: goal._id,
                title: goal.customParameterName || goal.parameter,
                googleEventId: goal.googleEventId,
                frequency: goal.trackingFrequency,
                deadline: goal.deadline,
                createdAt: goal.createdAt
            }))
        });
    } catch (error) {
        console.error('Get Synced Events Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch synced events',
            data: []
        });
    }
};

export const disconnectGoogle = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (user?.googleTokens?.access_token) {
            try {
                await oauth2Client.revokeToken(user.googleTokens.access_token);
                console.log('✅ Google token revoked');
            } catch (error) {
                console.error('⚠️ Failed to revoke token (will continue):', error.message);
            }
        }

        await User.findByIdAndUpdate(userId, {
            googleTokens: {
                access_token: null,
                refresh_token: null,
                scope: null,
                token_type: null,
                expiry_date: null
            },
            googleCalendarConnected: false
        });

        await HealthGoal.updateMany(
            { userId },
            { googleEventId: null, syncToGoogleCalendar: false }
        );

        res.json({
            success: true,
            message: 'Google Calendar disconnected successfully'
        });
    } catch (error) {
        console.error('Disconnect Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disconnect Google Calendar'
        });
    }
};