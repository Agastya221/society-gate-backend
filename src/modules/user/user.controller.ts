import { Request, Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';

const userService = new UserService();

export class UserController {

  // ============================================
  // BOOTSTRAP SUPER ADMIN
  // ============================================
  bootstrapSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { phone, name, email, bootstrapSecret } = req.body;
    const result = await userService.bootstrapSuperAdmin({
      phone,
      name,
      email,
      bootstrapSecret,
    });

    res.status(201).json({
      success: true,
      message:
        'SUPER_ADMIN created successfully. This endpoint is now permanently disabled.',
      data: result,
    });
  });

  // ============================================
  // RESIDENT APP — Verify MSG91 Widget Token
  // Creates new user account if first time login
  // ============================================
  residentWidgetVerify = asyncHandler(async (req: Request, res: Response) => {
    const { widgetToken, name, email } = req.body;
    const result = await userService.residentWidgetVerify(widgetToken, name, email);

    // Build appropriate welcome message
    let message: string;
    if (result.requiresOnboarding) {
      message = 'Welcome! Please complete your profile setup.';
    } else if (result.user.name) {
      message = `Welcome back, ${result.user.name}!`;
    } else {
      message = 'Welcome back!';
    }

    res.json({
      success: true,
      message,
      data: result,
    });
  });

  // ============================================
  // ADMIN APP — Verify MSG91 Widget Token
  // Existing ADMIN / RESIDENT / SUPER_ADMIN only
  // ============================================
  adminAppOtpVerify = asyncHandler(async (req: Request, res: Response) => {
    const { widgetToken } = req.body;
    const result = await userService.adminAppOtpVerify(widgetToken);

    res.json({
      success: true,
      message: `Welcome back, ${result.user.name}!`,
      data: result,
    });
  });

  // ============================================
  // GUARD APP — Verify MSG91 Widget Token
  // Existing GUARD accounts only
  // ============================================
  guardAppOtpVerify = asyncHandler(async (req: Request, res: Response) => {
    const { widgetToken } = req.body;
    const result = await userService.guardAppOtpVerify(widgetToken);

    res.json({
      success: true,
      message: `Welcome back, ${result.user.name}!`,
      data: result,
    });
  });

  // ============================================
  // ADMIN — Create Guard (OTP-only, no password)
  // ============================================
  createGuard = asyncHandler(async (req: Request, res: Response) => {
    const guard = await userService.createGuard(req.body, req.user!.id);

    res.status(201).json({
      success: true,
      message: 'Guard account created successfully',
      data: guard,
    });
  });

  // Get Profile
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);

    res.json({
      success: true,
      data: user,
    });
  });

  // Update Profile
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateProfile(req.user!.id, req.body);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  });

  // Get All Guards (Admin only)
  getGuards = asyncHandler(async (req: Request, res: Response) => {
    const guards = await userService.getGuards(req.user!.societyId!);

    res.json({
      success: true,
      data: guards,
    });
  });

  // Toggle User Status (Admin only)
  toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const user = await userService.toggleUserStatus(String(req.params.id), isActive, req.user!.societyId!);

    res.json({
      success: true,
      message: isActive ? 'User activated' : 'User deactivated',
      data: user,
    });
  });

  // Refresh Access Token
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const result = await userService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      message: 'Access token refreshed successfully',
      data: result,
    });
  });

  // Logout
  logout = asyncHandler(async (req: Request, res: Response) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const { refreshToken } = req.body;

    if (!accessToken) {
      throw new AppError('No access token provided', 400);
    }

    await userService.logout(accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

}