import { mount } from "svelte";
import App from "./App.svelte";
import "./oswald.css";
import "./app.css";

const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;
