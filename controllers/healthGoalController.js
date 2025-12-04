import HealthGoal from '../models/HealthGoal.js';
import HealthLog from '../models/HealthLog.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { analyzeHealthGoal } from '../services/geminiService.js';
import { google } from 'googleapis';

export const createHealthGoal = async (req, res) => {
    try {
        const {
            parameter, parameterKey, customParameterName, initialValue, targetValue, minValue, maxValue,
            unit, goalType, deadline, notes, trackingFrequency
        } = req.body;
        const userId = req.user.id;

        if (!parameter || !unit || !goalType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide parameter, unit, and goalType'
            });
        }

        if (parameterKey === 'custom') {
            if (!customParameterName || !customParameterName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Custom parameter name is required when using a custom health metric'
                });
            }
        }

        // Validate that at least one tracking method is provided
        const hasTarget = targetValue !== undefined && targetValue !== null && targetValue !== '';
        const hasMin = minValue !== undefined && minValue !== null && minValue !== '';
        const hasMax = maxValue !== undefined && maxValue !== null && maxValue !== '';
        const hasRange = hasMin || hasMax;
        const hasInitial = initialValue !== undefined && initialValue !== null && initialValue !== '';

        if (!hasTarget && !hasRange) {
            return res.status(400).json({
                success: false,
                message: 'Please provide either a targetValue OR a min/max range'
            });
        }

        // For fixed goals (non-range), require initialValue
        if (hasTarget && !hasRange && !hasInitial) {
            return res.status(400).json({
                success: false,
                message: 'Initial value is required for fixed target goals'
            });
        }

        // Validate min < max if both provided
        if (hasMin && hasMax && parseFloat(minValue) >= parseFloat(maxValue)) {
            return res.status(400).json({
                success: false,
                message: 'Min value must be less than max value'
            });
        }

        const parsedInitialValue = hasInitial ? parseFloat(initialValue) : null;
        const parsedTargetValue = hasTarget ? parseFloat(targetValue) : null;
        const parsedMinValue = hasMin ? parseFloat(minValue) : null;
        const parsedMaxValue = hasMax ? parseFloat(maxValue) : null;


        let currentValue = parsedInitialValue;

        const effectiveGoalType = (!hasTarget && hasRange) ? 'range' : goalType;

        const goal = await HealthGoal.create({
            userId,
            parameter,
            parameterKey: parameterKey || null,
            customParameterName: parameterKey === 'custom' ? customParameterName.trim() : null,
            initialValue: parsedInitialValue,
            targetValue: parsedTargetValue,
            minValue: parsedMinValue,
            maxValue: parsedMaxValue,
            currentValue,
            unit,
            goalType: effectiveGoalType,
            trackingFrequency: trackingFrequency || 'daily',
            deadline: deadline ? new Date(deadline) : null,
            notes,
            milestones: parsedInitialValue !== null ? [{
                date: new Date(),
                value: parsedInitialValue,
                note: 'Starting value (Initial)'
            }] : (currentValue !== null ? [{
                date: new Date(),
                value: currentValue,
                note: 'Starting value (from logs)'
            }] : [])
        });

        if (currentValue !== null) {
            goal.calculateProgress();
            if (goal.checkAchievement()) {
                goal.status = 'achieved';
            }
            await goal.save();
        }

        res.status(201).json({
            success: true,
            message: 'Health goal created successfully',
            data: goal
        });

    } catch (error) {
        console.error('Create Goal Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create health goal'
        });
    }
};

// Get all goals for user
export const getHealthGoals = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const query = { userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        const goals = await HealthGoal.find(query)
            .sort({ createdAt: -1 });

        // Check for expired goals (only if deadline is set)
        const now = new Date();
        for (const goal of goals) {
            if (goal.status === 'in-progress' && goal.deadline && new Date(goal.deadline) < now) {
                if (!goal.checkAchievement()) {
                    goal.status = 'expired';
                    await goal.save();
                }
            }
        }

        res.json({
            success: true,
            data: goals,
            total: goals.length
        });

    } catch (error) {
        console.error('Get Goals Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch goals'
        });
    }
};

// Get single goal by ID
export const getHealthGoalById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        res.json({
            success: true,
            data: goal
        });

    } catch (error) {
        console.error('Get Goal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch goal'
        });
    }
};

// Update goal progress (auto-triggered when new log is added)
export const updateGoalProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // Get latest value from logs
        const latestLog = await HealthLog.findOne({ userId })
            .sort({ recordDate: -1 });

        if (latestLog && latestLog.readings) {
            const reading = latestLog.readings.find(r =>
                r.testName.toLowerCase().includes(goal.parameter.toLowerCase()) ||
                goal.parameter.toLowerCase().includes(r.testName.toLowerCase())
            );

            if (reading) {
                const newValue = parseFloat(reading.value);
                goal.currentValue = newValue;

                // Add milestone
                goal.milestones.push({
                    date: new Date(),
                    value: newValue,
                    note: 'Progress update'
                });

                // Calculate progress
                goal.calculateProgress();

                // Check if achieved or needs to revert to in-progress
                if (goal.checkAchievement()) {
                    goal.status = 'achieved';
                } else if (goal.status === 'achieved') {
                    // For range goals: if was achieved but now outside range, revert to in-progress
                    goal.status = 'in-progress';
                }

                await goal.save();
            }
        }

        res.json({
            success: true,
            message: 'Goal progress updated',
            data: goal
        });

    } catch (error) {
        console.error('Update Goal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goal'
        });
    }
};

// Update all goals progress (called after adding new health log)
export const updateAllGoalsProgress = async (req, res) => {
    try {
        const userId = req.user.id;

        const goals = await HealthGoal.find({
            userId,
            status: 'in-progress'
        });

        const latestLog = await HealthLog.findOne({ userId })
            .sort({ recordDate: -1 });

        if (!latestLog || !latestLog.readings) {
            return res.json({
                success: true,
                message: 'No readings found to update goals'
            });
        }

        let updatedCount = 0;

        for (const goal of goals) {
            const reading = latestLog.readings.find(r =>
                r.testName.toLowerCase().includes(goal.parameter.toLowerCase()) ||
                goal.parameter.toLowerCase().includes(r.testName.toLowerCase())
            );

            if (reading) {
                const newValue = parseFloat(reading.value);
                goal.currentValue = newValue;

                goal.milestones.push({
                    date: new Date(),
                    value: newValue,
                    note: 'Auto-updated from health log'
                });

                goal.calculateProgress();

                if (goal.checkAchievement()) {
                    goal.status = 'achieved';
                } else if (goal.status === 'achieved') {
                    // For range goals: if was achieved but now outside range, revert to in-progress
                    goal.status = 'in-progress';
                }

                await goal.save();
                updatedCount++;
            }
        }

        res.json({
            success: true,
            message: `${updatedCount} goals updated successfully`,
            updatedCount
        });

    } catch (error) {
        console.error('Update All Goals Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goals'
        });
    }
};

// Edit goal
export const editHealthGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { initialValue, targetValue, minValue, maxValue, deadline, notes, trackingFrequency } = req.body;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // Update fields if provided
        const oldInitialValue = goal.initialValue;
        if (initialValue !== undefined) goal.initialValue = initialValue !== null && initialValue !== '' ? parseFloat(initialValue) : null;
        if (targetValue !== undefined) goal.targetValue = targetValue !== null && targetValue !== '' ? parseFloat(targetValue) : null;
        if (minValue !== undefined) goal.minValue = minValue !== null && minValue !== '' ? parseFloat(minValue) : null;
        if (maxValue !== undefined) goal.maxValue = maxValue !== null && maxValue !== '' ? parseFloat(maxValue) : null;
        if (deadline !== undefined) goal.deadline = deadline ? new Date(deadline) : null;
        if (notes !== undefined) goal.notes = notes;
        if (trackingFrequency !== undefined) goal.trackingFrequency = trackingFrequency;

        // If initialValue was changed and milestones has 0 or 1 entry, update currentValue too
        if (initialValue !== undefined && goal.initialValue !== oldInitialValue) {
            if (goal.milestones.length <= 1) {
                // Update currentValue to match new initialValue
                goal.currentValue = goal.initialValue;

                // Update the first milestone if exists, or create one
                if (goal.milestones.length === 1) {
                    goal.milestones[0].value = goal.initialValue;
                    goal.milestones[0].note = 'Starting value (Updated)';
                    goal.milestones[0].date = new Date();
                } else if (goal.milestones.length === 0 && goal.initialValue !== null) {
                    goal.milestones.push({
                        date: new Date(),
                        value: goal.initialValue,
                        note: 'Starting value (Initial)'
                    });
                }
            }
            // If more than 1 milestone, don't change currentValue - it should reflect actual progress
        }

        // Validate min < max if both provided
        if (goal.minValue !== null && goal.maxValue !== null && goal.minValue >= goal.maxValue) {
            return res.status(400).json({
                success: false,
                message: 'Min value must be less than max value'
            });
        }

        // Update goalType to 'range' if only min/max are set
        if (goal.targetValue === null && (goal.minValue !== null || goal.maxValue !== null)) {
            goal.goalType = 'range';
        }

        goal.calculateProgress();

        if (goal.checkAchievement()) {
            goal.status = 'achieved';
        } else if (goal.status === 'achieved') {
            // For range goals: if was achieved but now outside range, revert to in-progress
            goal.status = 'in-progress';
        }

        await goal.save();

        res.json({
            success: true,
            message: 'Goal updated successfully',
            data: goal
        });

    } catch (error) {
        console.error('Edit Goal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to edit goal'
        });
    }
};

// Delete a goal
export const deleteHealthGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // If goal has a Google Calendar event, delete it
        if (goal.googleEventId) {
            try {
                const user = await User.findById(userId);
                if (user?.googleTokens?.access_token) {
                    const oauth2Client = new google.auth.OAuth2(
                        process.env.GOOGLE_CLIENT_ID,
                        process.env.GOOGLE_CLIENT_SECRET,
                        process.env.GOOGLE_REDIRECT_URI
                    );
                    oauth2Client.setCredentials(user.googleTokens);
                    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: goal.googleEventId
                    });
                }
            } catch (calendarError) {
                console.error('Failed to delete calendar event:', calendarError);
                // Continue with goal deletion even if calendar deletion fails
            }
        }

        await HealthGoal.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Goal deleted successfully'
        });

    } catch (error) {
        console.error('Delete Goal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete goal'
        });
    }
};

// Get goal statistics
export const getGoalStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const goals = await HealthGoal.find({ userId });

        const stats = {
            total: goals.length,
            inProgress: goals.filter(g => g.status === 'in-progress').length,
            achieved: goals.filter(g => g.status === 'achieved').length,
            expired: goals.filter(g => g.status === 'expired').length,
            failed: goals.filter(g => g.status === 'failed').length,
            averageProgress: goals.length ?
                (goals.reduce((sum, g) => sum + g.progress, 0) / goals.length).toFixed(1) : 0,
            mostRecentAchievement: goals
                .filter(g => g.status === 'achieved')
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Goal Stats Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch goal statistics'
        });
    }
};

// Add milestone to goal
export const addMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { value, note } = req.body;

        if (!value) {
            return res.status(400).json({
                success: false,
                message: 'Value is required'
            });
        }

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // Add new milestone
        goal.milestones.push({
            date: new Date(),
            value: parseFloat(value),
            note: note || 'Manual entry'
        });

        // Update current value
        goal.currentValue = parseFloat(value);

        // Recalculate progress
        goal.calculateProgress();

        // Check if achieved or needs to revert to in-progress
        if (goal.checkAchievement()) {
            goal.status = 'achieved';
        } else if (goal.status === 'achieved') {
            // For range goals: if was achieved but now outside range, revert to in-progress
            goal.status = 'in-progress';
        }

        await goal.save();

        res.json({
            success: true,
            message: 'Milestone added successfully',
            data: goal
        });

    } catch (error) {
        console.error('Add Milestone Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add milestone'
        });
    }
};

// Edit milestone in goal
export const editMilestone = async (req, res) => {
    try {
        const { id, milestoneIndex } = req.params;
        const userId = req.user.id;
        const { value, note } = req.body;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        const idx = parseInt(milestoneIndex);
        if (idx < 0 || idx >= goal.milestones.length) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        if (value !== undefined) goal.milestones[idx].value = parseFloat(value);
        if (note !== undefined) goal.milestones[idx].note = note;

        if (idx === goal.milestones.length - 1 && value !== undefined) {
            goal.currentValue = parseFloat(value);
        }

        goal.calculateProgress();

        if (goal.checkAchievement()) {
            goal.status = 'achieved';
        } else if (goal.status === 'achieved') {
            goal.status = 'in-progress';
        }

        await goal.save();

        res.json({
            success: true,
            message: 'Milestone updated successfully',
            data: goal
        });

    } catch (error) {
        console.error('Edit Milestone Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to edit milestone'
        });
    }
};

// Delete milestone from goal
export const deleteMilestone = async (req, res) => {
    try {
        const { id, milestoneIndex } = req.params;
        const userId = req.user.id;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        const idx = parseInt(milestoneIndex);
        if (idx < 0 || idx >= goal.milestones.length) {
            return res.status(404).json({
                success: false,
                message: 'Milestone not found'
            });
        }

        if (goal.milestones.length === 1) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete the last milestone. Delete the goal instead.'
            });
        }

        goal.milestones.splice(idx, 1);

        if (goal.milestones.length > 0) {
            goal.currentValue = goal.milestones[goal.milestones.length - 1].value;
        }

        goal.calculateProgress();

        if (goal.checkAchievement()) {
            goal.status = 'achieved';
        } else if (goal.status === 'achieved') {
            goal.status = 'in-progress';
        }

        await goal.save();

        res.json({
            success: true,
            message: 'Milestone deleted successfully',
            data: goal
        });

    } catch (error) {
        console.error('Delete Milestone Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete milestone'
        });
    }
};

// Analyze goal with Gemini AI
export const analyzeGoalWithAI = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const goal = await HealthGoal.findOne({ _id: id, userId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // Call Gemini AI for analysis
        const analysis = await analyzeHealthGoal(goal.toObject());

        res.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze goal with AI'
        });
    }
};