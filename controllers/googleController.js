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
            state: req.user.id // Pass user ID in state
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

// Handle OAuth callback
export const googleCallback = async (req, res) => {
    try {
        const { code, state } = req.query;
        const userId = state;

        if (!code) {
            return res.redirect(`${process.env.CLIENT_URL}/calendar?error=no_code`);
        }

        const { tokens } = await oauth2Client.getToken(code);

        // Save tokens to user
        await User.findByIdAndUpdate(userId, {
            googleTokens: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date
            },
            googleCalendarConnected: true
        });

        res.redirect(`${process.env.CLIENT_URL}/calendar?success=true`);
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.redirect(`${process.env.CLIENT_URL}/calendar?error=auth_failed`);
    }
};

// Helper: Get authenticated calendar client
const getCalendarClient = async (userId) => {
    const user = await User.findById(userId);

    if (!user || !user.googleTokens?.access_token) {
        throw new Error('Google Calendar not connected');
    }

    oauth2Client.setCredentials(user.googleTokens);

    // Check if token needs refresh
    if (user.googleTokens.expiry_date && Date.now() >= user.googleTokens.expiry_date) {
        const { credentials } = await oauth2Client.refreshAccessToken();

        await User.findByIdAndUpdate(userId, {
            googleTokens: {
                ...user.googleTokens,
                access_token: credentials.access_token,
                expiry_date: credentials.expiry_date
            }
        });

        oauth2Client.setCredentials(credentials);
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
};

// Check connection status
export const checkConnection = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            connected: user?.googleCalendarConnected || false
        });
    } catch (error) {
        console.error('Check Connection Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check connection status'
        });
    }
};

// Create calendar event
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

        // Add weekly recurrence if specified
        if (recurrence) {
            event.recurrence = [recurrence]; // e.g., "RRULE:FREQ=WEEKLY"
        }

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });

        const eventId = response.data.id;

        // If goalId provided, update the goal with eventId
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

// Delete calendar event
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

        // Clear eventId from any goal that has it
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

        // If event not found, still consider it success
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

// Get synced events (goals with Google Calendar events)
export const getSyncedEvents = async (req, res) => {
    try {
        const userId = req.user.id;

        const goals = await HealthGoal.find({
            userId,
            googleEventId: { $ne: null }
        }).select('parameter googleEventId trackingFrequency deadline createdAt');

        res.json({
            success: true,
            data: goals.map(goal => ({
                goalId: goal._id,
                title: goal.parameter,
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
            message: 'Failed to fetch synced events'
        });
    }
};

// Disconnect Google Calendar
export const disconnectGoogle = async (req, res) => {
    try {
        const userId = req.user.id;

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

        // Clear all google event IDs from user's goals
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
