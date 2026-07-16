# Shadcn-Fe 设计规范

本文档从仓库根目录的 `shadcn.pen` 设计稿整理，约束 Web 工作台的视觉语言、页面结构、组件状态和设计稿同步方式。设计实现以当前前端代码为唯一交付基准；设计稿与代码不一致时，应先确认正确实现，再同步修正另一侧。

## 1. 设计原则

- 产品类型：克制、密集、可扫描的中后台 AI 工作台，不使用营销页式大面积装饰。
- 视觉方向：中性灰为基础，黑白高对比，靛蓝图表色作为数据强调，红色只表达危险和错误。
- 信息层级：优先依靠字号、字重、间距和表面层级建立秩序，避免滥用彩色背景。
- 组件策略：优先复用 `@workspace/ui/components/*` 中的 shadcn/ui 组件和语义变体。
- 图标策略：统一使用 `lucide-react`，图标服务于识别，不承担文案本身的含义。
- 主题策略：所有业务颜色使用语义 token；必须同时保证 light、dark 两套主题可读。

## 2. 设计稿结构

`shadcn.pen` 当前包含以下顶层内容：

- `Design System · Foundations`
- `Design System · Components`
- `Page · Login`
- `Page · 404 Not Found`
- `Page · AI Chat · Empty`
- `Page · AI Chat · Conversation`
- `Page · AI Chat · Search`
- `Page · AI Chat · Search Results`

Components 画板覆盖 Buttons、Form Controls、Navigation、Surfaces、Search Surfaces 和 Selected States；搜索场景还包含搜索对话框、类型筛选、最近会话列表与选中态。

所有页面画板统一使用 `1920 × 1080`。当前 Foundations 画板为 `1440 × 1160`，Components 画板为 `1440 × 1800`。

设计稿当前定义了 19 个可复用组件：

- 按钮：Default、Outline、Icon Default、Icon LG / Round。
- 表单与菜单：Input Field、Dropdown Menu。
- 导航：Sidebar Item Default、Active、Search。
- 表面与业务组件：Card、Chat Composer、Dialog · Chat Search。
- 状态组件：Focused Button、Expanded Button、Focused Icon、Focused Input、Toggle On、Checked Dropdown Item、Hover Search Result。

## 3. 基础变量

### 3.1 颜色

以下值来自 Pencil 变量表。透明色保留 8 位十六进制写法。

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `background` | `#FFFFFF` | `#0A0A0A` | 页面背景 |
| `foreground` | `#0A0A0A` | `#FAFAFA` | 主文字、主图标 |
| `foreground-75` | `#0A0A0ABF` | `#FAFAFABF` | 次一级前景 |
| `card` | `#FFFFFF` | `#171717` | 卡片表面 |
| `card-foreground` | `#0A0A0A` | `#FAFAFA` | 卡片内容 |
| `card-ring` | `#0A0A0A0D` | `#FAFAFA1A` | 卡片外描边 |
| `popover` | `#FFFFFF` | `#171717` | 浮层表面 |
| `popover-foreground` | `#0A0A0A` | `#FAFAFA` | 浮层内容 |
| `primary` | `#171717` | `#E5E5E5` | 主按钮、主操作 |
| `primary-foreground` | `#FAFAFA` | `#171717` | 主操作上的内容 |
| `secondary` | `#F5F5F5` | `#262626` | 次级表面 |
| `secondary-70` | `#F5F5F5B3` | `#262626B3` | 半透明次级表面 |
| `secondary-foreground` | `#171717` | `#FAFAFA` | 次级表面内容 |
| `muted` | `#F5F5F5` | `#262626` | 弱化背景、悬停背景 |
| `muted-45` | `#F5F5F573` | `#26262673` | 轻量悬停、选中背景 |
| `muted-foreground` | `#737373` | `#A1A1A1` | 辅助文字、占位符 |
| `muted-foreground-40` | `#73737366` | `#A1A1A166` | 更弱的提示内容 |
| `accent` | `#F5F5F5` | `#262626` | 强调交互表面 |
| `accent-foreground` | `#171717` | `#FAFAFA` | 强调表面内容 |
| `border` | `#E5E5E5` | `#FFFFFF1A` | 边框、分割线 |
| `input` | `#E5E5E5` | `#FFFFFF26` | 输入控件边界 |
| `input-surface` | `#E5E5E580` | `#FFFFFF13` | 输入控件表面 |
| `ring` | `#A1A1A1` | `#737373` | 焦点环 |
| `destructive` | `#E7000B` | `#FF6467` | 删除、错误、危险操作 |
| `sidebar` | `#FAFAFA` | `#171717` | 侧边栏背景 |
| `sidebar-foreground` | `#0A0A0A` | `#FAFAFA` | 侧边栏内容 |
| `sidebar-primary` | `#171717` | `#4F46E5` | 侧边栏主选中态 |
| `sidebar-primary-foreground` | `#FAFAFA` | `#FAFAFA` | 侧边栏主选中态内容 |
| `sidebar-accent` | `#F5F5F5` | `#262626` | 侧边栏悬停/次选中态 |
| `sidebar-accent-foreground` | `#171717` | `#FAFAFA` | 侧边栏强调内容 |
| `sidebar-border` | `#E5E5E5` | `#FFFFFF1A` | 侧边栏边界 |
| `sidebar-ring` | `#A1A1A1` | `#737373` | 侧边栏焦点环 |

图表色在两套主题中保持一致：

| Token | 值 |
| --- | --- |
| `chart-1` | `#A3B3FF` |
| `chart-2` | `#615FFF` |
| `chart-3` | `#4F39F6` |
| `chart-4` | `#432DD7` |
| `chart-5` | `#372AAC` |

使用规则：

- 禁止在业务页面直接使用 `text-green-*`、`bg-blue-*` 等具体色阶表达业务语义。
- 普通反馈优先使用 foreground、muted 和组件 variant；红色只用于破坏性操作或错误。
- hover、selected 等轻状态优先使用 `muted-45`，不要用高饱和色块抢占视觉层级。
- 边框优先使用 `border`；焦点必须使用 `ring`，不可只依赖颜色变化。

### 3.2 字体

| Token | 字体 | 用途 |
| --- | --- | --- |
| `font-sans` | Inter | 拉丁字符、数字、默认 UI |
| `font-heading` | Inter | 标题 |
| `font-mono` | JetBrains Mono | 代码、技术标识、文件类型 |
| `font-cjk` | Noto Sans SC | 中文正文回退 |
| `font-ui-cjk` | Noto Sans SC | 中文界面回退 |

字号沿用 Tailwind 默认比例。工作台正文以 `14px` 为主；辅助标签可使用 `12px`；卡片标题通常使用 `16px`；AI Chat 空状态主标题使用 `32px`。标题保持中等或半粗字重，避免大面积粗体。

### 3.3 间距

采用 4px 基准并保留半步长：

| Token | px | Token | px |
| --- | ---: | --- | ---: |
| `space-0_5` | 2 | `space-1` | 4 |
| `space-1_5` | 6 | `space-2` | 8 |
| `space-2_5` | 10 | `space-3` | 12 |
| `space-3_5` | 14 | `space-4` | 16 |
| `space-5` | 20 | `space-6` | 24 |
| `space-7` | 28 | `space-8` | 32 |
| `space-10` | 40 | `space-12` | 48 |
| `space-14` | 56 | `space-16` | 64 |

布局优先使用 `flex` / `grid` 与 `gap-*`；不要使用 `space-x-*` / `space-y-*`。同一密度层级中优先重复使用 8、12、16、20、24px，避免任意间距。

### 3.4 圆角

Pencil 圆角变量以 `7.2px` 为基准：

| Token | 值 |
| --- | ---: |
| `radius-sm` | 4.32px |
| `radius-md` | 5.76px |
| `radius-base` / `radius-lg` | 7.2px |
| `radius-xl` | 10.08px |
| `radius-2xl` | 12.96px |
| `radius-3xl` | 15.84px |
| `radius-4xl` | 18.72px |

使用规则：按钮和表单控件默认采用 `rounded-2xl`；菜单项采用 `rounded-xl`；卡片采用大圆角但封顶 `24px`；胶囊按钮、头像和 AI 输入框紧凑态使用 `rounded-full`。

### 3.5 阴影与描边

- 页面和普通内容区不使用装饰性阴影。
- Card 使用两层轻阴影：`0 1px 3px #0000001A` 与 `0 1px 2px #0000000F`，并使用 1px `card-ring`。
- Dropdown 使用 `0 16px 34px #0F172A24`，配合 1px `#E5E5E566` 描边。
- 搜索 Dialog 使用两层悬浮阴影：`0 20px 25px -5px #0000001A` 与 `0 8px 10px -6px #0000001A`，配合 1px `card-ring`。
- 输入、按钮、卡片的视觉边界优先由语义 border/ring 提供，不手写独立灰色。

## 4. 核心组件

### 4.1 Button

- 默认按钮高度 32px、圆角 `radius-2xl`；默认图标按钮为 `32 × 32px`，圆形大图标按钮为 `36 × 36px`。
- 默认按钮右侧 padding 12px、图标侧 padding 10px，图标与文字间距 6px；图标统一为 16px。
- 支持 `default`、`outline`、`secondary`、`ghost`、`destructive`、`link`。
- focus-visible 使用 1px `ring` 描边和 3px、30% 透明度的外环；disabled 为 50% opacity 且禁止事件。
- loading 使用 `disabled` 与旋转图标组合；图标标注 `data-icon="inline-start"` 或 `inline-end`。

### 4.2 Form Controls

- 输入框默认高度 32px、水平 padding 10px、圆角 `radius-2xl`；label 与输入框间距 12px。
- 表单表面使用 `input-surface`，默认透明描边；placeholder 使用 muted foreground。
- focused 状态使用 1px `ring` 描边和 3px 外环，保持输入框内容及尺寸不跳动。
- 校验失败时容器设置 `data-invalid`，控件设置 `aria-invalid`，显示明确错误文本。
- 表单采用 `FieldGroup`、`Field`、`FieldLabel`、`FieldDescription`、`FieldError` 的结构。

### 4.3 Dropdown / Select

- 浮层：宽度 240px、`popover` 背景、`rounded-2xl`、6px 内边距及规范阴影。
- 选项：高度 40px、`rounded-xl`、左右 14px 内边距，文字 14px。
- hover、highlighted、checked 统一使用 `muted-45`；选中图标使用 `primary`。
- `SelectItem` 必须位于 `SelectGroup`；菜单项应放在合理的 `DropdownMenuGroup` 中。

### 4.4 Card / Surface

- Card 设计基准宽度 420px，使用 `card` / `card-foreground`，内边距与内容间距均为 20px，圆角为 `radius-4xl`。
- Card title 默认 16px medium，description 默认 14px muted foreground。
- 普通业务页面减少嵌套卡片；优先通过边框、分割线和留白区分区域。
- Dialog、Sheet、Drawer 必须有 Title、关闭路径和焦点管理；隐藏标题使用 `sr-only`。

### 4.5 Navigation

- 全局布局沿用现有 Sidebar + Header，不为单一页面新建平行导航框架。
- 选中项使用 sidebar primary 或 sidebar accent；未选中项保持中性前景。
- 图标和文字共同表达导航含义；图标按钮必须提供 Tooltip 或 `sr-only` 文本。

### 4.6 Search Surfaces

- 搜索使用 `672 × 568px` 居中 Dialog 承载，定位于 1920px 画板的 `x=624, y=256`；遮罩使用 `#0000004D`。
- 结构顺序：68px 搜索 Header → 52px 类型筛选 → 最近/匹配结果。
- 搜索输入高度 40px；最近聊天行高 48px；文档/匹配结果行高 64px；结果容器内边距 8px、行间距 4px。
- 列表项必须覆盖 default、hover、selected、empty、loading、error 状态。
- 最近会话结果保持单行可扫描，长标题截断，选中态使用轻量 muted 背景。

## 5. 页面模式

### 5.1 Login

- 使用全屏居中单列布局，表单宽度固定为 384px，组间距 24px。
- Logo 容器为 `32 × 32px`，标题为 20px bold；输入框和登录按钮高度均为 32px。
- 页面背景保持纯净，表单是唯一主视觉焦点。
- 主操作全宽；错误就近显示；提交时禁用重复操作并提供 loading。

### 5.2 404 Not Found

- 页面保留 256px Sidebar 与 56px Header；内容水平垂直居中，卡片宽度为 448px、内边距 20px、内容间距 20px。
- 清楚说明当前状态，并提供返回安全入口的主操作。
- 不加入插画式大面积装饰，保持后台产品一致性。

### 5.3 AI Chat

- 使用 256px Sidebar 与主内容双区结构，Sidebar 内边距 8px；顶部 Header 高度 56px。
- 空状态：主标题居中，标题 32px semibold；标题与输入区间距 28px；输入区宽度 792px。
- 对话态：主内容右侧可展开 384px 思考抽屉，抽屉左侧使用 1px border；消息区与抽屉共同填充剩余宽度。
- 用户消息靠右，AI 内容使用带 1px border、14px 圆角的开放表面。
- Chat Composer 基础组件宽度 640px、高度 56px、圆角 28px；页面内根据容器使用 792px 或 fill-container。
- 搜索态使用遮罩和居中搜索浮层；搜索结果态必须保留类型筛选与最近会话分组。
- 思考过程、附件、音频、流式输出均需有独立 loading、empty 和失败反馈。

## 6. 状态与动效

每个可交互组件至少覆盖：default、hover、focus-visible、active、disabled；数据组件还需覆盖 loading、empty、error、success。

- hover：100–200ms 的颜色/阴影过渡，避免位移造成布局抖动。
- active：按钮允许 1px 下压反馈，弹出型触发器不使用位移。
- focus：始终保留可见 ring，不能用 `outline-none` 后不补焦点样式。
- loading：保留控件原尺寸，避免文本替换导致跳动。
- mutation：成功使用 `sonner` toast；失败优先展示服务端 `detail` / `message`。
- 删除、禁用、覆盖、退出登录等高风险操作必须二次确认。

## 7. 响应式与可访问性

- 设计稿基准为 1920 × 1080，但实现必须在窄屏下不重叠、不截断关键操作。
- 固定侧栏或辅助面板在空间不足时应折叠、转为 Sheet，或让主内容安全滚动。
- 文本与交互元素保持足够对比；不能仅用颜色表达状态。
- 图标按钮提供可访问名称；Avatar 必须有 `AvatarFallback`。
- 浮层必须有标题、关闭路径、焦点圈定和 Escape 行为。
- 表单控件必须与 label、description、error 建立语义关联。

## 8. 实现与同步

- 主题 token 和全局样式只在 `packages/ui/src/styles/globals.css` 维护。
- 通用基础组件放在 `packages/ui/src/components`；Web 专属组件放在 `apps/web/src/components`；页面模块放在 `apps/web/src/pages/<module>`。
- 业务样式优先使用 Tailwind 语义类，如 `bg-background`、`text-muted-foreground`、`border-border`。
- 条件 class 使用 `cn()`；等宽高使用 `size-*`。
- 前端页面或组件视觉发生新增、修改、删除时，必须同步更新根目录 `shadcn.pen` 中对应画板。
- 设计稿同步后检查布局问题与视觉效果；页面画板保持 1920 × 1080，并覆盖关键交互、加载、空和错误状态。

## 9. 交付检查清单

- 颜色只使用语义 token，light/dark 均已检查。
- 字号、间距、圆角来自既定尺度，没有无依据的任意值。
- 组件覆盖 hover、focus、active、disabled、loading、error 等必要状态。
- 下拉浮层、表单、卡片、导航符合本规范的统一样式。
- 桌面与窄屏下没有重叠或关键操作截断。
- 键盘可达、aria、标题、关闭路径和焦点管理完整。
- 前端实现与 `shadcn.pen` 已双向同步，并完成布局与视觉检查。
