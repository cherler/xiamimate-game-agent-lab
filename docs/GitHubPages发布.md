# GitHub Pages 发布记录

首次上线：2026-11-18。

- 公开仓库：[cherler/xiamimate-game-agent-lab](https://github.com/cherler/xiamimate-game-agent-lab)
- 在线试玩：[虾米对练场](https://cherler.github.io/xiamimate-game-agent-lab/)
- 源代码：`main` 分支。
- 发布内容：`gh-pages` 分支根目录，仅 `index.html`、`.nojekyll` 和 `release.json`。
- Pages 配置：Deploy from a branch，`gh-pages`，`/(root)`，HTTPS 已启用。
- 首次源码版本：`01a9b915db8d751a7a535b833baafbdef9d1168b`。
- 首次发布版本：`3b82918b33d1a1b986d96a157e540c4212296be1`。
- [首次部署成功记录](https://github.com/cherler/xiamimate-game-agent-lab/actions/runs/44309250285)。

五款游戏的单人规则玩法直接运行在浏览器里。模型和好友房服务没有部署到 Pages。现有阿里云服务没有参与这次发布。

## 更新试玩页

维护者在已登录 GitHub 的本机执行：

```sh
npm test
git add <本次修改的文件>
git commit -m "Describe the update"
git push origin main
npm run deploy:pages
```

现行发布策略只保留一个试玩版本；旧版、试验版与对照页已撤下，历史源码保留在分支中。每次发布使用仅含三个入口文件的新文件树，回滚也不会恢复历史网页目录。

发布脚本要求源码已提交，重新生成静态页面后，将产物提交到 `gh-pages`。它保留原发布历史、使用普通推送，不切换当前工作分支，也不上传环境配置、模型权重或本机运行目录。

推送后，GitHub 自带的 Pages 流程负责上线。在仓库 Actions 中确认 `pages build and deployment` 成功；公开的 [release.json](https://cherler.github.io/xiamimate-game-agent-lab/release.json) 记录对应源码版本，可检查浏览器实际收到的版本。

仓库中的 `docs/examples/pages-workflow.yml` 是备用 Actions 模板。当前使用发布分支，不需要启用该模板。

官方配置说明：[从分支发布 GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
