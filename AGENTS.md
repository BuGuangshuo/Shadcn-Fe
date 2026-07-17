# Test Frontend Agent Guide

## 1. 项目定位

这是一个基于 Vite、React Router 和 shadcn/ui 的中后台工作台前端

## 2. 工程概览

- 仓库类型：pnpm workspace + Turbo monorepo
- 应用入口：`apps/web`
- UI 包：`packages/ui`
- 框架：Vite + React 19 + TypeScript
- 路由：`react-router-dom` 7
- UI：shadcn/ui + Radix primitives + Tailwind CSS v4
- 图标：`lucide-react`
- 表格：`@tanstack/react-table`
- 图表：Recharts，经 `@workspace/ui/components/chart` 包装
- Toast：`sonner`
- 校验：`zod`

不要轻易引入新的 UI 框架、路由方案、状态管理、表格库、表单库或 CSS-in-JS 方案。

## 3. 目录边界

- `apps/web/src/main.tsx`：应用挂载入口
- `apps/web/src/App.tsx`：应用级 Provider 组合
- `apps/web/src/router/`：路由定义、懒加载页面、鉴权路由守卫
- `apps/web/src/routes/navigation.tsx`：侧边栏导航与页面标题映射
- `apps/web/src/layouts/`：应用布局，如 `AppLayout`
- `apps/web/src/pages/`：页面级模块
- `apps/web/src/components/`：当前 Web 应用私有组件
- `apps/web/src/service/`：接口请求、类型和业务 API 封装
- `apps/web/src/lib/`：应用级上下文、Provider、工具 glue code
- `packages/ui/src/components/`：可复用 shadcn/ui 组件源码
- `packages/ui/src/styles/globals.css`：Tailwind v4、主题 token、全局样式入口
- `packages/ui/src/lib/utils.ts`：共享工具，如 `cn`

业务页面优先放在 `apps/web/src/pages/<module>/index.tsx`。跨页面但只属于 Web 应用的组件放 `apps/web/src/components`。只有真正通用、可被其他应用复用的基础 UI 才放进 `packages/ui`。

## 4. shadcn/ui 规则

当前项目有两个 `components.json`，但组件源码集中在 `packages/ui/src/components`。在 `apps/web` 中使用组件时，优先从 `@workspace/ui/components/*` 导入：

```tsx
import { Button } from '@workspace/ui/components/button';
```

新增 shadcn 组件使用项目包管理器和 Web 应用配置：

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

组件使用约定：

- 先查并复用已有 `packages/ui/src/components`，不要重复造基础控件
- 组件变体优先用已有 `variant`、`size` 和语义 token
- 条件 class 使用 `cn()`，不要手写复杂模板字符串
- 布局用 `flex` + `gap-*`，不要使用 `space-x-*` / `space-y-*`
- 等宽高使用 `size-*`，不要写 `w-* h-*`
- 状态颜色使用语义 token 或组件 variant，避免 `text-green-*`、`bg-blue-*` 这类硬编码色
- Dialog、Sheet、Drawer 必须有对应 Title；视觉隐藏时使用 `sr-only`
- Button loading 通过 `disabled` + 图标组合实现，图标加 `data-icon`
- Avatar 必须有 `AvatarFallback`
- SelectItem 放在 SelectGroup 内，DropdownMenuItem 放在 DropdownMenuGroup 或合理菜单结构内
- 所有下拉浮层统一使用思考模式下拉样式：白色 `bg-background`、`rounded-2xl`、`p-1.5`、浅色 shadow/ring；选项使用 `min-h-10`、`rounded-xl`、`px-3.5`，hover 和 selected 状态使用 `bg-muted/45`，选中图标使用 `text-primary`
- 新增下拉优先复用 `@workspace/ui/components/select` 和 `@workspace/ui/components/dropdown-menu` 的默认样式，不要在业务组件里覆盖成其他菜单主题
- 空状态、提示、分割线、加载态优先使用 `Empty`、`Alert`、`Separator`、`Skeleton` 等已有组件

图标默认使用 `lucide-react`。按钮内图标不要额外写尺寸类，使用组件样式和 `data-icon="inline-start"` / `data-icon="inline-end"`。

## 5. 路由与信息架构

路由定义集中在 `apps/web/src/router/index.tsx`。新增受保护页面应挂在 `ProtectedRoute` 下，并通过 `AppLayout` 承载。

新增导航入口时同步维护：

- `apps/web/src/router/index.tsx`
- `apps/web/src/routes/navigation.tsx`
- 必要的页面标题映射 `getRouteTitle`

信息架构优先采用中后台常见结构：

- 列表页作为业务入口
- 详情页用于查看完整信息
- Dialog、Sheet、Drawer 用于轻量创建、编辑、确认
- 隐藏路由只承载流程步骤，不承担主导航职责

不要让同一业务出现多个平级入口，也不要绕过现有侧边栏与 Header 布局自建页面框架。

## 6. 鉴权与接口

鉴权边界：

- 路由守卫：`apps/web/src/router/auth-routes.tsx`
- 鉴权状态：`apps/web/src/lib/auth-provider.tsx`
- 鉴权上下文类型：`apps/web/src/lib/auth-context.ts`
- 登录、续期、登出和用户信息接口：`apps/web/src/service/auth/index.ts`

新增需要登录态的功能应通过 `useAuth()` 获取用户和会话状态，不要直接读取 localStorage 作为业务判断来源。

接口约定：

- 业务 API 放在 `apps/web/src/service/<domain>/index.ts`
- 请求类型、响应类型和领域常量靠近对应 service 维护
- `VITE_API_BASE_URL` 和 Vite proxy 已存在，默认接口路径可继续使用 `/api/v1/...`
- 出错信息应优先使用服务端返回的 `detail` / `message`
- 重复出现的 fetch、鉴权 header、错误解析逻辑应抽成共享 helper，不要在页面里散落复制

保存、删除、启停等 mutation 必须处理 loading、错误提示和成功后的局部刷新。

## 7. 页面与组件模式

页面组件保持薄层：

- 负责页面布局、数据组织和业务动作编排
- 复杂表格、表单、抽屉、弹窗拆到同目录 `components/`
- 纯展示或可复用业务块再提升到 `apps/web/src/components`

### 7.1 功能模块化

业务模块不得长期把领域类型、纯工具函数、接口编排、副作用、复杂交互和全部 JSX 挤在单个页面文件中。出现以下任一情况时应主动拆分：

- 文件同时承担 3 个及以上相对独立职责
- 页面中存在可命名的完整功能区，如列表、编辑器、消息区、筛选区、详情面板
- 语音、上传、流式响应、滚动同步、拖拽等复杂副作用与页面布局混杂
- 同类类型、常量、格式化函数或状态更新逻辑开始重复
- 文件已明显影响定位、评审和测试；通常超过约 400～500 行时需要检查拆分空间，不以行数作为唯一标准

页面级模块优先采用以下结构，按实际需要创建，不要求机械补齐空目录：

```text
apps/web/src/pages/<module>/
├── index.tsx              # 页面入口与顶层业务编排
├── components/            # 仅属于当前模块的展示和交互组件
├── hooks/                 # 状态、副作用及浏览器能力封装
├── types.ts               # 当前模块内部共享的领域类型
├── constants.ts           # 稳定常量和配置项
├── utils.ts               # 无 React 状态、副作用的纯函数
└── <feature>.ts           # 流式处理、数据转换等独立业务流程
```

职责边界：

- `index.tsx` 只保留页面布局、模块状态组合、会话或请求流程编排，不放大段子组件 JSX 和通用纯函数
- `components/` 中的组件应围绕明确功能命名，通过 props 接收数据和动作，不直接读取页面私有状态
- `hooks/` 负责一组内聚的状态和副作用，并完整处理初始化、清理、取消和异常状态
- `utils.ts` 中的函数应保持纯粹、可复用、无 DOM 操作、无网络请求、无 toast
- 请求地址、后端类型和可跨页面复用的 API 逻辑仍放在 `service/<domain>`；页面目录只保留当前页面特有的流程编排
- 同一模块内共享的类型放在模块 `types.ts`；仅单文件使用的类型保留在使用处，不要为拆分而拆分
- 跨页面复用后再提升到 `apps/web/src/components`、`apps/web/src/hooks` 或 `apps/web/src/lib`，不要提前把业务私有实现做成全局抽象
- 避免无意义的单函数文件、只有转发作用的组件和大范围 barrel export；优先直接导入具体模块，保持依赖关系清晰

状态和副作用归属：

- 状态尽量由最接近其消费者的组件或 hook 持有；只有多个模块确实需要协同时才提升
- 事件监听、定时器、媒体流、AbortController、动画帧等资源必须在所属 hook 或流程模块中集中创建和清理
- 流式更新、上传队列等高频状态更新应使用稳定回调和函数式更新，避免因拆分产生陈旧闭包
- 派生数据优先在渲染期间计算或使用 `useMemo`，不要用 effect 维护可直接推导的重复状态

模块化重构要求：

- 以保持现有行为、样式、文案和接口契约不变为默认目标；若需改变行为，应作为独立需求说明
- 先提取类型、常量和纯函数，再拆 UI、hooks 和业务流程，最后精简页面入口
- 拆分后不得形成循环依赖，也不要把 `packages/ui` 反向依赖到业务模块
- 交付前至少执行模块级 lint、应用 typecheck；涉及路由、跨包依赖或构建边界时执行 build

列表和表格优先沿用 `@tanstack/react-table` + `@workspace/ui/components/table` 的模式。已有 `DataTable` 展示了列定义、排序、筛选、分页、可见列、选择和行操作的组合方式。

表单优先使用 shadcn 的 `FieldGroup`、`Field`、`FieldLabel`、`FieldDescription`、`FieldError`。校验错误时：

- `Field` 设置 `data-invalid`
- 控件设置 `aria-invalid`
- 提交按钮绑定真实异步状态并 `disabled`
- 表单校验未通过时不要进入 loading 状态

反馈统一使用 `sonner` 的 `toast`。删除、禁用、覆盖、退出登录等高风险操作必须二次确认。

## 8. 样式与主题

Tailwind v4 和主题 token 集中在 `packages/ui/src/styles/globals.css`。新增全局 token 或主题变量只改这个文件，不要新增平行全局 CSS 入口。

样式分层：

- 简单布局、间距、对齐、响应式优先用 Tailwind class
- 颜色、背景、边框、文字优先使用语义 token：`bg-background`、`text-muted-foreground`、`border-border` 等
- 条件样式使用 `cn()`
- 可复用基础视觉放在 `packages/ui`
- 应用级页面样式留在 `apps/web` 组件内

避免事项：

- 不要用超长 class 串承载复杂业务状态
- 不要在页面里硬编码大批颜色值或暗色模式覆盖
- 不要手写 overlay 的 z-index
- 不要新增与现有 radius、font、sidebar token 脱节的设计变量

## 9. 交互与可访问性

新增交互必须覆盖：

- loading 状态
- disabled 状态
- 空状态
- 错误状态
- 成功反馈
- 键盘可达性
- 基本 aria 属性

图标按钮必须有 `sr-only` 文本或 Tooltip。Dialog、Sheet、Drawer、Popover 等浮层必须有明确标题、关闭路径和焦点管理。

后台工作台应保持克制、密集、可扫描。不要把普通业务页做成营销落地页，也不要新增与当前 sidebar/header 模式冲突的大面积装饰视觉。

## 10. 命令

项目要求 Node.js `>=20`，包管理器为 `pnpm@10.33.4`。

常用命令：

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm format
```

单应用开发：

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web typecheck
```

UI 包检查：

```bash
pnpm --filter @workspace/ui lint
pnpm --filter @workspace/ui typecheck
```

当前仓库没有发现独立 test 脚本。交付前至少执行与改动范围匹配的 `lint`、`typecheck`，涉及构建配置、路由、样式主题或跨包依赖时执行 `pnpm build`。

## 11. 代码风格

- 使用 TypeScript，避免无意义的 `any`
- React 组件使用函数组件
- 导入顺序遵循现有文件风格：React/第三方、应用别名、workspace UI
- 应用内路径别名 `@` 指向 `apps/web/src`
- workspace UI 使用 `@workspace/ui/...`
- 不要把 `packages/ui` 反向依赖到 `apps/web`
- 不要在业务代码中读取或修改生成产物 `dist`
- 不要把 mock 数据长期留在页面逻辑中；示例数据应靠近模块并明确命名

改动应小而聚焦。不要在实现单个功能时顺手重排无关文件、替换 UI 体系或改动锁文件，除非依赖变化确实需要。

## 12. 交付检查

提交或交付前确认：

- 路由可访问，受保护页面会正确跳转登录
- 导航、标题、面包屑或 Header 文案同步更新
- 页面在桌面和窄屏下不重叠、不截断关键操作
- 表单有校验、错误提示和提交 loading
- mutation 成功后只刷新必要数据，不整页刷新
- toast、confirm、空状态和错误状态存在
- `pnpm lint` / `pnpm typecheck` / `pnpm build` 按风险执行并记录结果

## 13. 设计稿同步

- 前端组件或页面样式有新增、修改或删除时，必须同步更新 `/shadcn.pen` 中对应的设计稿组件或页面
- 设计稿必须以当前前端实现为唯一基准进行高保真还原，逐项对齐布局、尺寸、间距、圆角、颜色、边框、阴影、字体、图标、文案、交互状态、加载状态、空状态和错误状态，不得使用仅表达大致结构的低保真占位稿代替
- 设计稿更新后必须执行布局与视觉检查
- 所有页面设计稿画板统一使用 `1920 × 1080` 尺寸；设计系统 Foundations、Components 等非页面展示板可按内容需要设置尺寸
