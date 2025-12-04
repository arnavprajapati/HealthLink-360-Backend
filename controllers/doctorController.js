import HealthLog from '../models/HealthLog.js';
import Connection from '../models/Connection.js';

// @desc    Get specific patient's health data for doctor
// @route   GET /api/connect/patient/:patientId/data
// @access  Private (Doctor only, linked patients only)
export const getPatientHealthData = async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctorId = req.user.id;

        // 1. Verify connection exists and is accepted
        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this patient\'s data'
            });
        }

        // 2. Fetch Health Logs
        const logs = await HealthLog.find({ userId: patientId })
            .sort({ recordDate: -1 });

        // 3. Calculate Trends (Simple aggregation for MVP)
        // We can do this on frontend or backend. Doing it here saves bandwidth if logs are huge,
        // but sending raw logs allows flexible frontend graphing. 
        // For MVP, sending all logs is fine.

        res.status(200).json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        console.error('Get Patient Data Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching patient data'
        });
    }
};
