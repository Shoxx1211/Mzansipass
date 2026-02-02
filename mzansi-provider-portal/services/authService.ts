import axios from "axios";

const API_BASE = "http://localhost:5000";

export async function agencyLogin(email: string, password: string) {
  const res = await axios.post(`${API_BASE}/agency/auth/login`, {
    email,
    password,
  });

  return res.data;
}
