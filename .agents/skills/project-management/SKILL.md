---
name: project-management
description: AIPMプロジェクト管理CLIの操作マニュアル。プロジェクトの作成（project:create）、一覧表示（project:list）、rules.tsへのチャンネル登録、knowledgeのプロジェクトスコープ管理について案内する。ユーザーが「プロジェクトを作りたい」「チャンネルを追加したい」「ナレッジの保存先は？」「プロジェクト一覧」などと言った場合に使用する。
---

# AIPM プロジェクト管理ガイド

## 概要

AIPMではSlackチャンネルとプロジェクトが1:1で対応する。プロジェクトを作成すると、設定ファイルとプロジェクト専用のknowledgeディレクトリが生成される。

```
projects/
└── my-app/
    ├── project.ts         # プロジェクト設定
    └── knowledge/         # プロジェクトスコープの ADR
        └── *.md
```

## プロジェクトの作成

```bash
bun run project:create
```

対話式ウィザードが起動し、以下の4ステップで進む:

### Step 1: Basic Info
- **プロジェクト名** (必須): 表示名（例: "My App"）
- **スラッグ**: ディレクトリ名。名前から自動生成される（例: "my-app"）
- **説明**: 任意

### Step 2: Slack Channel
- **チャンネルID** (必須): Slackの `C` で始まるID（例: C0123456789）
- **チャンネル名**: 任意（例: #my-app）

既に同じチャンネルIDが別プロジェクトで使われている場合はエラーになる。

### Step 3: GitHub (optional)
- `owner/repo` 形式で入力。Enterでスキップ。

### Step 4: Notion (optional)
- Notion Database IDを入力。Enterでスキップ。

### 生成されるファイル
- `projects/{slug}/project.ts` — プロジェクト設定（`ProjectConfig` 型）
- `projects/{slug}/knowledge/.gitkeep` — ADR保存先

## プロジェクト一覧の表示

```bash
bun run project:list
```

全プロジェクトの名前、チャンネルID、GitHub/Notion連携状況を一覧表示する。

## プロジェクト作成後のrules.ts編集

`project:create` 完了時にコンソールに表示されるスニペットを `rules.ts` の `channels` に追加する。

```typescript
// rules.ts
const rules = {
  channels: {
    // 既存のチャンネル...

    // project:create が案内するスニペットをここに追加
    "C0123456789": {
      name: "#my-app",
      on_message: {
        guard: true,
        prompt: "投稿を分析し、必要に応じてNotionにタスク登録してください。",
      },
      on_reaction: {
        memo: { prompt: "Notionにタスクとして登録してください。" },
      },
    },
  },
} as const satisfies Rules;
```

`rules.ts` はユーザーが手動で編集するファイルなので、CLIからは自動編集しない。

## knowledgeのプロジェクトスコープ

Slackイベント発生時、チャンネルIDからプロジェクトを逆引きする:

- **プロジェクトが見つかった場合**: `projects/{slug}/knowledge/` にADRを保存
- **見つからなかった場合**: 従来の `knowledge/{channelId}/` にフォールバック

この仕組みにより、既存のチャンネルIDベースの運用は維持しつつ、プロジェクトを作成したチャンネルはプロジェクト配下にknowledgeが集約される。

## プロジェクト設定の型

```typescript
// src/project.ts で定義
interface ProjectConfig {
  name: string;           // 表示名
  channelId: string;      // Slackチャンネル（1:1）
  channelName?: string;   // "#my-app"
  description?: string;
  github?: { owner: string; repo: string };
  notion?: { databaseId: string };
  createdAt: string;      // ISO 8601
}
```

## 関連コマンド

| コマンド | 説明 |
|---------|------|
| `bun run project:create` | プロジェクトを対話式に作成 |
| `bun run project:list` | プロジェクト一覧を表示 |
| `bun run setup` | 初回セットアップ（Slack/Notion/GitHub/Sentry） |
| `bun run dev` | AIPM起動 |
