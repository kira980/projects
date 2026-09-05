import { InstallClient } from "./install-client";

export const metadata = { title: "התקנת אפליקציית הנוכחות" };

/**
 * The page the owner sends a worker once their phone is registered: one
 * button that puts the attendance app on their home screen.
 *
 * Public on purpose — it holds nothing but the install prompt, and the
 * worker needs to reach it before they have anything else.
 */
export default function InstallPage() {
  return <InstallClient />;
}
