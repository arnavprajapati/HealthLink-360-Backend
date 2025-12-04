import Connection from '../models/Connection.js';
import User from '../models/User.js';


export const sendConnectionRequest = async (req, res) => {
    try {
        const { doctorEmail } = req.body;
        const patientId = req.user.id;

        const doctor = await User.findOne({ email: doctorEmail.toLowerCase(), role: 'doctor' });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found with this email'
            });
        }

        const existingConnection = await Connection.findOne({
            doctor: doctor._id,
            patient: patientId
        });

        if (existingConnection) {
            if (existingConnection.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Connection request already sent'
                });
            }
            if (existingConnection.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    message: 'You are already connected with this doctor'
                });
            }
            // If rejected, allow re-sending (optional, but good for UX)
            // For now, let's update the existing one to pending
            existingConnection.status = 'pending';
            existingConnection.requestDate = Date.now();
            await existingConnection.save();

            return res.status(200).json({
                success: true,
                message: 'Connection request sent successfully'
            });
        }

        await Connection.create({
            doctor: doctor._id,
            patient: patientId,
            status: 'pending'
        });

        res.status(200).json({
            success: true,
            message: 'Connection request sent successfully'
        });
    } catch (error) {
        console.error('Send Connection Request Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error sending request'
        });
    }
};


export const getIncomingRequests = async (req, res) => {
    try {
        const requests = await Connection.find({
            doctor: req.user.id,
            status: 'pending'
        })
        .populate('patient', 'displayName email photoURL')
        .sort('-requestDate');

        res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    } catch (error) {
        console.error('Get Requests Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching requests'
        });
    }
};

export const respondToRequest = async (req, res) => {
    try {
        const { requestId, status } = req.body; // status: 'accepted' or 'rejected'

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const connection = await Connection.findOne({
            _id: requestId,
            doctor: req.user.id
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: 'Connection request not found'
            });
        }

        connection.status = status;
        connection.responseDate = Date.now();
        await connection.save();

        res.status(200).json({
            success: true,
            message: `Request ${status} successfully`
        });
    } catch (error) {
        console.error('Respond Request Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error responding to request'
        });
    }
};


export const getLinkedPatients = async (req, res) => {
    try {
        const connections = await Connection.find({
            doctor: req.user.id,
            status: 'accepted'
        })
        .populate('patient', 'displayName email photoURL')
        .sort('-updatedAt');

        const patients = connections.map(conn => ({
            ...conn.patient.toObject(),
            connectionId: conn._id,
            linkedSince: conn.updatedAt
        }));

        res.status(200).json({
            success: true,
            count: patients.length,
            patients
        });
    } catch (error) {
        console.error('Get Linked Patients Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching patients'
        });
    }
};

export const getLinkedDoctors = async (req, res) => {
    try {
        const connections = await Connection.find({
            patient: req.user.id,
            status: 'accepted'
        })
        .populate('doctor', 'displayName email photoURL doctorProfile')
        .sort('-updatedAt');

        const doctors = connections.map(conn => ({
            ...conn.doctor.toObject(),
            connectionId: conn._id,
            linkedSince: conn.updatedAt
        }));

        res.status(200).json({
            success: true,
            count: doctors.length,
            doctors
        });
    } catch (error) {
        console.error('Get Linked Doctors Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching doctors'
        });
    }
};
