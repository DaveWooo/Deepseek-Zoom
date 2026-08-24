# Project Guidelines & Rules

## 1. 每次更新必须修改版本号 (Mandatory Version Bumping)

- **规则**：每次对项目进行代码修改、功能新增、重构或 Bug 修复后，**必须递增版本号**并同步更新 `CHANGELOG.md`。
- **执行方式**：
    - 使用命令：`npm run version:patch`（日常修复与调整）、`npm run version:minor`（新功能特性）或 `npm run version:major`（破坏性重大变更）。
    - 该脚本会自动同步更新 `package.json`、`manifest.json`、`package-lock.json` 并往 `CHANGELOG.md` 中添加新版本段落。
    - 在 `CHANGELOG.md` 中记录具体的改动条目与说明。

## 2. 质量与验证规范 (QA & Verification)

- 代码修改完成后，运行 `npm run check` 验证代码格式、构建产物、TypeScript 类型（`tsc --noEmit`）以及单元测试均正常通过。
