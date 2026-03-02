import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function Layout() {
  return (
    <div>
      <Header />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
