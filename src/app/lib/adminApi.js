import { supabase } from "./supabaseClient";

export const adminApi = {
  async fetchWithToken(url, options = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        let errorMsg = `Error ${res.status}`;
        let status = res.status;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        const err = new Error(errorMsg);
        err.status = status;
        throw err;
      }
      const data = await res.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async listUsers() {
    return this.fetchWithToken("/api/admin/users", { method: "GET" });
  },

  async createUser({ email, password, email_confirm }) {
    return this.fetchWithToken("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm }),
    });
  },

  async updateUserById(id, { password }) {
    return this.fetchWithToken("/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({ id, password }),
    });
  },

  async deleteUser(id) {
    return this.fetchWithToken(`/api/admin/users?id=${id}`, { method: "DELETE" });
  }
};
