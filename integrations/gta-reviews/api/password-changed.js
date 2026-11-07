import { handlePasswordChanged } from "../server/password-flag.js";

export default function handler(req, res) {
  return handlePasswordChanged(req, res);
}
