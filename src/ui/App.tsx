import packageJson from "../../package.json";
import { formatGameVersion } from "../engine/version";

export default function App() {
  const version = formatGameVersion(packageJson.version);
  return (
    <main>
      <h1>La Flotte</h1>
      <p>Version {version}</p>
    </main>
  );
}
