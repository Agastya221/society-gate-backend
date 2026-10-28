import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/ResponseHandler';
import * as service from './staff-task.service';

export const createStaffTaskSchema = z.object({
  domesticStaffId: z.string().uuid(),
  title: z.string().trim().min(2, 'Say what needs doing').max(120),
  note: z.string().trim().max(500).optional(),
  blockId: z.string().uuid().optional(),
  location: z.string().trim().max(120).optional(),
});

const societyOf = (req: Request): string => {
  const societyId = req.user?.societyId;
  if (!societyId) throw new AppError('You are not assigned to a society', 403);
  return societyId;
};

// ---- guards and admins: give a task, see where it stands ----
export const assignableStaff = async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.listAssignableStaff(societyOf(req)) });

export const createTask = async (req: Request, res: Response) =>
  res.status(201).json({ success: true, message: 'Task given', data: await service.createTask(societyOf(req), { id: req.user!.id }, req.body) });

export const listTasks = async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.listTasks(societyOf(req), req.query.scope === 'all' ? 'all' : 'open') });

export const cancelTask = async (req: Request, res: Response) =>
  res.json({ success: true, message: 'Task cancelled', data: await service.cancelTask(societyOf(req), String(req.params.id), { id: req.user!.id, role: req.user!.role }) });

// ---- the staff app ----
const staffId = (req: Request) => req.staffAccount!.domesticStaffId;
export const myTasks = async (req: Request, res: Response) => res.json({ success: true, data: await service.tasksForStaff(staffId(req)) });
export const acceptMyTask = async (req: Request, res: Response) => res.json({ success: true, data: await service.acceptTask(staffId(req), String(req.params.id)) });
export const finishMyTask = async (req: Request, res: Response) => res.json({ success: true, data: await service.finishTask(staffId(req), String(req.params.id)) });
