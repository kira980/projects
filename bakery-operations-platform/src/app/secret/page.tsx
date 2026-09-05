import { requireAdmin } from "@/lib/auth";
import { getEncryptionSetup } from "./actions";
import { SecretClient } from "./secret-client";

export const metadata = { title: "הכנסות" };

/**
 * Everything on this page is opened in the browser. The server hands over
 * the sealed rows and the wrapped key and knows nothing more.
 */
export default async function SecretPage() {
  await requireAdmin();
  const setup = await getEncryptionSetup();
  return <SecretClient setup={setup} />;
}
