import { AuthForm } from "../../../components/auth-form";
import { getRequestLocale } from "../../../lib/i18n-server";

export default async function LoginPage() {
  const locale = await getRequestLocale();
  return <AuthForm mode="login" locale={locale} />;
}
