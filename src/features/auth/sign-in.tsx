import { useState, type FormEvent } from "react";
import { getCloudClient } from "@/lib/storage/supabase";

export function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(username)) {
      setError("아이디에는 영문, 숫자, 하이픈과 밑줄을 사용할 수 있어요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await getCloudClient().auth.signInWithPassword({
        email: username + "@payplan.example.com",
        password: String(data.get("password") ?? ""),
      });
      if (error) {
        setError(error.status === 429
          ? "로그인 시도가 많아요. 잠시 후 다시 시도해 주세요."
          : "로그인하지 못했어요. 아이디와 비밀번호를 확인해 주세요.");
      }
    } catch {
      setError("로그인 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="layout main-content">
      <section className="panel mx-auto max-w-md p-6 sm:p-8">
        <h1 className="mb-3 text-3xl!">페이플랜 로그인</h1>
        <p className="muted mb-6">같은 계정으로 폰과 PC에서 시나리오를 열 수 있어요.</p>
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            아이디
            <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </label>
          <label className="field">
            비밀번호
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
        </form>
      </section>
    </main>
  );
}
