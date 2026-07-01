# Agent Guide

主要前端约定维护在 [AGENT.md](./AGENT.md)。补充规则：

- 所有下拉浮层统一使用思考模式下拉样式：白色 `bg-background`、`rounded-2xl`、`p-1.5`、浅色 shadow/ring；选项使用 `min-h-10`、`rounded-xl`、`px-3.5`，hover 和 selected 状态使用 `bg-muted/45`，选中图标使用 `text-primary`
- 新增下拉优先复用 `@workspace/ui/components/select` 和 `@workspace/ui/components/dropdown-menu` 的默认样式，不要在业务组件里覆盖成其他菜单主题
