import { useState, type ComponentProps, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Loader2Icon, ShieldCheckIcon } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/service/auth"

export function LoginForm({ className, ...props }: ComponentProps<"div">) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasError = Boolean(error)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!username.trim() || !password) {
      setError("请输入用户名和密码。")
      return
    }

    setIsSubmitting(true)

    try {
      await login(username.trim(), password)
      toast.success("登录成功", {
        position: "top-center",
      })
      navigate(searchParams.get("redirect") || "/dashboard", { replace: true })
    } catch (loginError) {
      const message =
        loginError instanceof ApiError
          ? loginError.message
          : "登录失败，请稍后重试。"

      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">欢迎回来</h1>
                <p className="text-balance text-muted-foreground">
                  使用企业账号登录工作台
                </p>
              </div>

              <Field data-invalid={hasError || undefined}>
                <FieldLabel htmlFor="username">用户名</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-invalid={hasError}
                  disabled={isSubmitting}
                  required
                />
              </Field>

              <Field data-invalid={hasError || undefined}>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={hasError}
                  disabled={isSubmitting}
                  required
                />
                <FieldError>{error}</FieldError>
              </Field>

              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2Icon data-icon="inline-start" />}
                  {isSubmitting ? "正在登录" : "登录"}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                登录即会创建受保护会话，并在 token 过期前自动续期。
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative hidden bg-muted md:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--primary)_0,transparent_28%),linear-gradient(135deg,var(--muted),var(--secondary))]" />
            <div className="absolute inset-x-8 bottom-8 rounded-2xl bg-background/80 p-5 shadow-sm backdrop-blur">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheckIcon data-icon="inline-start" />
                企业级会话保护
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Bearer token、refresh token、会话 TTL 和服务端登出统一接入。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        点击继续即表示你同意我们的 <Link to="/terms">服务条款</Link> 和{" "}
        <Link to="/privacy">隐私政策</Link>。
      </FieldDescription>
    </div>
  )
}
