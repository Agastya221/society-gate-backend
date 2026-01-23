
import { Request, Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';

const userService = new UserService();

export class UserController {


  // RESIDENT APP - Request OTP
  // UserController
  requestResidentOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    const ip = (req.ip as string) || (req.headers['x-forwarded-for'] as string) || '';
    await userService.requestResidentOtp(phone, ip);

    res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  });

  // NEW: Verify OTP and create profile (for onboarding)
  verifyOtpAndCreateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp, name, email } = req.body;

    if (!name) {
      throw new AppError('Name is required', 400);
    }

    const result = await userService.verifyOtpAndCreateProfile(phone, otp, name, email);

    res.json({
      success: true,
      message: result.requiresOnboarding
        ? 'Profile created successfully. Please complete onboarding.'
        : 'Welcome back!',
      data: result,
    });
  });

  // LEGACY: Verify OTP (backward compatibility)
  verifyResidentOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;

    const result = await userService.verifyOtpAndLoginResident(phone, otp);

    res.json({
      success: true,
      message: `Welcome back!`,
      data: result,
    });
  });


  // RESIDENT APP - Login
  residentAppLogin = asyncHandler(async (req: Request, res: Response) => {
    const { phone, email, password } = req.body;
    // Accept either phone or email as identifier
    const identifier = email || phone;

    if (!identifier || !password) {
      throw new AppError('Phone/Email and password are required', 400);
    }

    const result = await userService.residentAppLogin(identifier, password);

    res.json({
      success: true,
      message: `Welcome back, ${result.user.name}!`,
      data: result,
    });
  });

  // GUARD APP - Login
  guardAppLogin = asyncHandler(async (req: Request, res: Response) => {
    const { phone, password } = req.body;
    const result = await userService.guardAppLogin(phone, password);

    res.json({
      success: true,
      message: `Welcome back, ${result.user.name}!`,
      data: result,
    });
  });

  // ADMIN - Create Guard
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
    const guards = await userService.getGuards(req.user!.societyId);

    res.json({
      success: true,
      data: guards,
    });
  });

  // Toggle User Status (Admin only)
  toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const user = await userService.toggleUserStatus(req.params.id, isActive);

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