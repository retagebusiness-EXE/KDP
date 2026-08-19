"use server";

import { redirect } from "next/navigation";
import { AuthError, CredentialsAuthProvider } from "./service";
import { setSessionCookie, clearSessionCookie } from "./session";

export interface AuthFormState {
  error?: string;
}

const provider = new CredentialsAuthProvider();

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  try {
    const { token } = await provider.register(email, password, name);
    await setSessionCookie(token);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    return { error: "Something went wrong creating your account." };
  }
  redirect("/dashboard");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { token } = await provider.login(email, password);
    await setSessionCookie(token);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    return { error: "Something went wrong signing you in." };
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
