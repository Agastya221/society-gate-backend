"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("./middlewares/error.middleware");
// Import routes
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const society_routes_1 = __importDefault(require("./modules/society/society.routes"));
const entry_routes_1 = __importDefault(require("./modules/entry/entry.routes"));
const delivery_routes_1 = __importDefault(require("./modules/delivery/delivery.routes"));
const domestic_staff_routes_1 = __importDefault(require("./modules/domestic-staff/domestic-staff.routes"));
const preapproval_routes_1 = __importDefault(require("./modules/preapproval/preapproval.routes"));
const gatepass_routes_1 = __importDefault(require("./modules/gatepass/gatepass.routes"));
const notice_routes_1 = __importDefault(require("./modules/notice/notice.routes"));
const amenity_routes_1 = __importDefault(require("./modules/amenity/amenity.routes"));
const complaint_routes_1 = __importDefault(require("./modules/complaint/complaint.routes"));
const emergency_routes_1 = __importDefault(require("./modules/emergency/emergency.routes"));
const vendor_routes_1 = __importDefault(require("./modules/vendor/vendor.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const onboarding_routes_1 = __importDefault(require("./modules/onboarding/onboarding.routes"));
const app = (0, express_1.default)();
// Load Swagger documentation
const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, '../swagger.yaml'));
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Swagger API Documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Society Gate API Documentation',
}));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// API Documentation redirect
app.get('/', (_req, res) => {
    res.redirect('/api-docs');
});
// Routes
app.use('/api/auth', user_routes_1.default);
app.use('/api/societies', society_routes_1.default);
app.use('/api/entries', entry_routes_1.default);
app.use('/api/deliveries', delivery_routes_1.default);
app.use('/api/domestic-staff', domestic_staff_routes_1.default);
app.use('/api/preapprovals', preapproval_routes_1.default);
app.use('/api/gatepasses', gatepass_routes_1.default);
app.use('/api/notices', notice_routes_1.default);
app.use('/api/amenities', amenity_routes_1.default);
app.use('/api/complaints', complaint_routes_1.default);
app.use('/api/emergencies', emergency_routes_1.default);
app.use('/api/vendors', vendor_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/onboarding', onboarding_routes_1.default);
// Error handler (must be last)
app.use(error_middleware_1.errorHandler);
exports.default = app;
