import { redirect } from "next/navigation";

export default function SubmitRedirect() {
  redirect("/dashboard");
}