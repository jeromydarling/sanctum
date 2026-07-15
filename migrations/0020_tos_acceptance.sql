-- Records that a user accepted the Terms of Service + Privacy Policy at signup
-- (clickwrap: creating the account is the acceptance). Timestamp = acceptance time.
ALTER TABLE profiles ADD COLUMN tos_accepted_at TEXT;
