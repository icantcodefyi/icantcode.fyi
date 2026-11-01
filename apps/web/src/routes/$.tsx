export function meta() {
  return [{ title: "404 · icantcode.fyi" }, { name: "robots", content: "noindex" }];
}

export default function NotFound() {
  return (
    <main>
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <p>
        <a href="/">Back home</a>
      </p>
    </main>
  );
}
