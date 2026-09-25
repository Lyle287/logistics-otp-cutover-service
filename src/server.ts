import { createHttpApp } from "./http_app.js";

const port = Number(process.env.PORT || 3000);
const app = createHttpApp();

app.listen(port, () => {
  console.log(`logistics service listening on http://localhost:${port}`);
});
