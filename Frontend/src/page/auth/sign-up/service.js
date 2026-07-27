import apiService from "../../../services/api.service";

/**
 * Self-serve signup: creates a pending account with no org yet.
 * An org admin must admit the account before it can log in anywhere.
 */
const signUp = async ({ firstName, lastName, email, password }) => {
  try {
    if (!firstName || !lastName || !email || !password) {
      return { error: "All fields are required" };
    }

    const response = await apiService.authInstance.post("/auth/signup", {
      first_name: firstName,
      last_name: lastName,
      email,
      password,
    });

    return response.data;
  } catch (error) {
    return {
      error: error?.response?.data?.message || "An unknown error occurred",
    };
  }
};

export { signUp };
