import { supabase } from "./supabaseClient";

export const adminApi = {
  async fetchWithToken(url, options = {}) {
    try {
      const headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (currentUser.role === "admin" && currentUser.token) {
        headers["Authorization"] = `Bearer static_${currentUser.token}`;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error("Your session has expired. Please log in again.");
        }
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
        console.error("[adminApi] API Error:", errorMsg);
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

  async updateProfile(id, payload) {
    return this.fetchWithToken("/api/admin/profiles", {
      method: "PUT",
      body: JSON.stringify({ id, payload }),
    });
  },

  async deleteUser(id) {
    return this.fetchWithToken(`/api/admin/users?id=${id}`, { method: "DELETE" });
  },

  async db(table, action, options = {}) {
    return this.fetchWithToken("/api/admin/db", {
      method: "POST",
      body: JSON.stringify({ table, action, ...options }),
    });
  }
};
