const express = require('express');
const router = express.Router();

// Controllers
const memberController = require('../controllers/memberController');
const bikeController = require('../controllers/bikeController');
const helpController = require('../controllers/helpController');
const fallbackController = require('../controllers/fallbackController');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');

const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');
const gatewayController = require('../controllers/gatewayController');
const facebookWebhookController = require('../controllers/facebookWebhookController');

// Gateway Secret Verification Middleware
const verifyGateway = (req, res, next) => {
    const token = req.headers['x-gateway-secret'];
    if (!token || token !== process.env.GATEWAY_SECRET) {
        console.log(`[Security] Blocked unauthorized gateway attempt from IP: ${req.ip}`);
        return res.status(403).json({ error: 'Unauthorized Gateway' });
    }
    next();
};

// Member Check Route
router.post('/members/check', verifyGateway, memberController.checkMember);

// Bike Routes (SMS Endpoints)
router.post('/search', verifyGateway, bikeController.search);
router.post('/search-all', verifyGateway, bikeController.searchAll);
router.post('/locations', verifyGateway, bikeController.locations);
router.post('/usage', verifyGateway, bikeController.usage);
router.post('/borrow', verifyGateway, bikeController.borrow);
router.post('/done', verifyGateway, bikeController.done);
router.post('/good', verifyGateway, bikeController.good);
router.post('/broken', verifyGateway, bikeController.broken);
router.post('/missing', verifyGateway, bikeController.missing);
router.post('/delivered', verifyGateway, bikeController.delivered);
router.post('/points', verifyGateway, bikeController.points);

// Help Routes
router.post('/help', verifyGateway, helpController.help);
router.post('/how', verifyGateway, helpController.how);

// Outbound SMS Gateway Queue (Secured)
router.get('/gateway/outbound', verifyGateway, gatewayController.getPendingSms);
router.post('/gateway/outbound/:id/sent', verifyGateway, gatewayController.markSmsSent);
router.get('/gateway/debug-db', verifyGateway, gatewayController.debugDb);
router.get('/gateway/test-notifications', verifyGateway, gatewayController.testNotifications);

// Public Auth & Admin Routes
router.post('/auth/login', memberController.login);
router.post('/admin/login', adminController.login);

// Admin Routes (Secured with authMiddleware)
router.get('/admin/settings', authMiddleware, adminController.getSettings);
router.post('/admin/settings', authMiddleware, adminController.updateSettings);
router.get('/admin/members', authMiddleware, adminController.getMembers);
router.post('/admin/members', authMiddleware, adminController.addMember);
router.post('/admin/bicycles', authMiddleware, adminController.addBicycle);
router.post('/admin/locations', authMiddleware, adminController.addLocation);
router.post('/admin/resolve-dispute', authMiddleware, adminController.resolveDispute);

router.get('/admin/search-bike', authMiddleware, adminController.searchBike);
router.get('/admin/search-member', authMiddleware, adminController.searchMember);
router.post('/admin/override-points', authMiddleware, adminController.overridePoints);
router.post('/admin/override-bike', authMiddleware, adminController.overrideBike);
router.post('/admin/delete-member', authMiddleware, adminController.deleteMember);
router.post('/admin/activate-member', authMiddleware, adminController.activateMember);
router.post('/admin/hard-delete-member', authMiddleware, adminController.hardDeleteMember);
router.post('/admin/delete-bike', authMiddleware, adminController.deleteBike);
router.post('/admin/bicycles/toggle', authMiddleware, adminController.toggleBike);
router.post('/admin/delete-location', authMiddleware, adminController.deleteLocation);
router.post('/admin/locations/toggle', authMiddleware, adminController.toggleLocation);
router.get('/admin/reports', authMiddleware, adminController.getReports);

// Fallback Routes
router.post('/invalid-command', verifyGateway, fallbackController.invalidCommand);
router.post('/non-registered', verifyGateway, fallbackController.nonRegistered);

// Public Dashboard Routes
router.get('/student/dashboard', authMiddleware, memberController.getStudentDashboard);
router.get('/student/leaderboards', authMiddleware, memberController.getLeaderboards);
router.get('/bicycles', bikeController.getBicycles);
router.get('/locations', bikeController.getLocations);
router.get('/history/:bicycleCode', bikeController.getHistory);
router.get('/analytics', analyticsController.getAnalytics);

// Admin UI Routes (Requires authentication)
router.get('/admin/search/bicycles', authMiddleware, adminController.searchBicycles);
router.get('/admin/search/members', authMiddleware, adminController.searchMembers);
router.post('/admin/bicycles/override', authMiddleware, adminController.overrideBicycle);
router.delete('/admin/locations/:name', authMiddleware, adminController.deleteLocation);
router.get('/admin/maintenance', authMiddleware, adminController.getMaintenanceQueue);
router.post('/admin/resolve-delivery', authMiddleware, adminController.resolveDelivery);
router.get('/admin/honesty', authMiddleware, adminController.getHonestyLogs);

// Facebook Webhook Routes (Publicly accessible by Meta servers)
router.get('/webhook/facebook', facebookWebhookController.verifyWebhook);
router.post('/webhook/facebook', facebookWebhookController.handleWebhookEvent);

// Public Privacy Policy Route (Required by Facebook App Review)
router.get('/privacy-policy', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>UP Bikeshare Privacy Policy</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    padding: 40px 20px;
                    max-width: 700px;
                    margin: auto;
                    line-height: 1.6;
                    color: #1e293b;
                    background-color: #f8fafc;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e2e8f0;
                }
                h1 {
                    color: #7b1113;
                    font-size: 1.8rem;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 12px;
                    margin-bottom: 24px;
                }
                h2 {
                    color: #0f172a;
                    font-size: 1.3rem;
                    margin-top: 32px;
                }
                ul {
                    padding-left: 20px;
                }
                li {
                    margin-bottom: 10px;
                }
                p {
                    margin-bottom: 16px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>UP Bikeshare Privacy Policy</h1>
                <p><strong>Effective Date:</strong> July 2, 2026</p>
                <p>This privacy policy explains how UP Bikeshare handles user data within the Facebook Messenger Chatbot. We are committed to protecting the privacy of our registered members and students.</p>
                
                <h2>1. Information We Collect & How We Use It</h2>
                <ul>
                    <li><strong>Facebook PSID (Page-Scoped ID):</strong> Used solely to identify your chat thread so our bot can guide you through the dispute appeal process step-by-step.</li>
                    <li><strong>Registered Phone Number:</strong> Requested during verification to verify you are a registered UP Bikeshare member with frozen points.</li>
                    <li><strong>Appeal Photos:</strong> The bike photo you upload is stored securely and displayed to verified administrators in the UP Bikeshare dashboard for the sole purpose of auditing dispute tickets and restoring points.</li>
                </ul>
                
                <h2>2. Data Retention & Deletion</h2>
                <p>We only store chat session states and image links for the duration of the dispute. Once the admin resolves the dispute verdict, the photo link is cleared from our active bicycle states. If you wish to delete your chatbot session, type <strong>"RESET"</strong> in the chat to clear session records immediately.</p>
                
                <h2>3. Contact Us</h2>
                <p>For questions or requests regarding your data, please contact the UP Bikeshare Student Committee.</p>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
