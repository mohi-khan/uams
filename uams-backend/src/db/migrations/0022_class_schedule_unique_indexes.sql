-- Prevent the same room from being double-booked at the same date + time slot
CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_room_slot
  ON class_schedules (tenant_id, session_date, time_slot_id, room_id)
  WHERE room_id  IS NOT NULL
    AND deleted_at IS NULL
    AND status    != 'CANCELLED';

-- Prevent the same teacher from being scheduled twice at the same date + time slot
CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_teacher_slot
  ON class_schedules (tenant_id, session_date, time_slot_id, teacher_id)
  WHERE teacher_id IS NOT NULL
    AND deleted_at  IS NULL
    AND status     != 'CANCELLED';

-- Prevent the same batch from having two classes at the same date + time slot
CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_batch_slot
  ON class_schedules (tenant_id, session_date, time_slot_id, batch_id)
  WHERE batch_id IS NOT NULL
    AND deleted_at IS NULL
    AND status    != 'CANCELLED';
