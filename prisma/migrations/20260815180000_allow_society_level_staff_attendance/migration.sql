-- Staff registered by a society admin may work for the society rather than a
-- particular flat. Attendance at the gate must therefore allow a null flat.
ALTER TABLE "StaffAttendance" ALTER COLUMN "flatId" DROP NOT NULL;
