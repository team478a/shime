import { redirect } from "next/navigation";
import { getStaffSession } from "../../../server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getStaffSession()) redirect("/admin");
  return <main><section className="panel"><h1>SHIME 運営ログイン</h1><LoginForm /></section></main>;
}
