import { redirect } from "next/navigation";
import { getStaffSession } from "../../../server/auth";
import { PlatformConsole } from "./platform-console";
export default async function PlatformPage(){const session=await getStaffSession();if(!session)redirect("/admin/login");if(session.role!=="system_admin")redirect("/admin");return <main><PlatformConsole/></main>}
