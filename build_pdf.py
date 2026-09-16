from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib import colors

import build_text_review as text_model


ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parent
OUT = PROJECT / "output" / "人间铸剑录_v15_完整图解版.pdf"
PILOT_OUT = PROJECT / "output" / "v15-layout-pilot.pdf"
ZHOU_MILI_SOURCE = ROOT / "output" / "imagegen" / "v5" / "zhoumili-v5.png"
AVATAR_DIR = PROJECT / "assets" / "chat-avatars"
PREFLIGHT = PROJECT / "evidence" / "pdf-preflight-v15.json"

SOURCE = text_model.load_source()
STORIES, STORY_MANIFEST = text_model.load_story_layers(SOURCE)
base = SOURCE.base
CHAPTERS = SOURCE.CHAPTERS
SUPPLEMENTS = SOURCE.SUPPLEMENTS
VOLUMES = SOURCE.VOLUMES
SUPPLEMENTS_BY_CHAPTER = {index: [] for index in range(1, 25)}
for supplement in SUPPLEMENTS:
    SUPPLEMENTS_BY_CHAPTER[supplement["chapter"]].append(supplement)

DEFAULT_CROP = "square-512-face-0.50-0.23-zoom-1.33-circle-v2"
ZHOU_MILI_CROP = "square-512-face-0.50-0.34-zoom-1.33-circle-v1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def crop_chat_avatar(source: Path, speaker: str, center_y: float, contract: str) -> tuple[Path, dict]:
    fingerprint = hashlib.sha256(f"{sha256(source)}:{contract}".encode("utf-8")).hexdigest()[:16]
    target = AVATAR_DIR / f"{speaker}-{fingerprint}.png"
    if not target.is_file():
        AVATAR_DIR.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            rgb = image.convert("RGB")
            crop_size = int(min(rgb.size) * 0.75)
            center_x = rgb.width * 0.50
            face_y = rgb.height * center_y
            left = max(0, min(rgb.width - crop_size, int(center_x - crop_size / 2)))
            top = max(0, min(rgb.height - crop_size, int(face_y - crop_size / 2)))
            square = rgb.crop((left, top, left + crop_size, top + crop_size)).resize(
                (512, 512), Image.Resampling.LANCZOS
            )
            mask = Image.new("L", square.size, 0)
            ImageDraw.Draw(mask).ellipse((0, 0, 511, 511), fill=255)
            output = square.convert("RGBA")
            output.putalpha(mask)
            output.save(target, optimize=True)
    return target, {
        "source": str(source.relative_to(ROOT)),
        "source_sha256": sha256(source),
        "crop_contract": contract,
        "derivative": str(target.relative_to(PROJECT)),
    }


def prepare_v15_chat_avatars(portraits: dict[str, Path]) -> dict[str, Path]:
    if not ZHOU_MILI_SOURCE.is_file():
        raise FileNotFoundError(f"missing Zhou Mili portrait: {ZHOU_MILI_SOURCE}")
    result: dict[str, Path] = {}
    manifest = {}
    for speaker, source in portraits.items():
        result[speaker], manifest[speaker] = crop_chat_avatar(source, speaker, 0.23, DEFAULT_CROP)
    result["周米粒"], manifest["周米粒"] = crop_chat_avatar(
        ZHOU_MILI_SOURCE, "周米粒", 0.34, ZHOU_MILI_CROP
    )
    evidence = PROJECT / "evidence" / "pdf-avatar-cache-v15.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


class BookV15(SOURCE.BookV14):
    def __init__(self, output: Path, assets: dict[str, object]):
        self.stories = STORIES
        super().__init__(output, assets)
        self.chat_avatars = prepare_v15_chat_avatars(assets["portraits"])
        self.canvas.setTitle("人间铸剑录：Go 后端与 Harness AI 工程全书图解版 v15")
        self.canvas.setSubject("v15.0.0 · 轻小说事故喜剧 · ELI5 完整解释层 · Go 后端与 Harness AI 工程")
        self.canvas.setKeywords("v15.0.0, Go, backend, Harness AI, ELI5, story, chat")

    def calculate_chapter_pages(self) -> dict[int, int]:
        page = 6
        result = {}
        for index, chapter in enumerate(CHAPTERS, 1):
            if index in VOLUMES:
                page += 1
            result[index] = page + 1
            code_lines = chapter["code"].strip().splitlines()
            if len(code_lines) <= 20:
                code_pages = 1
            elif len(code_lines) <= 38:
                code_pages = 2
            else:
                code_pages = math.ceil(len(code_lines) / 32) + 1
            page += 2 + len(chapter["diagrams"]) + code_pages + 1
            for item in SUPPLEMENTS_BY_CHAPTER[index]:
                page += 3 + len(SOURCE.v11.v10.supplement_code_chunks(item))
        return result

    def compact_avatar_band(
        self, speaker: str, text: str, x: float, y: float, width: float, height: float
    ) -> None:
        c = self.canvas
        is_learner = speaker == "陈平安"
        avatar_size = 34
        avatar_x = x + width - avatar_size if is_learner else x
        avatar_y = y + height - avatar_size - 2
        label = base.SPEAKER_LABELS.get(speaker, speaker)
        text_size, leading = 9.1, 11.5
        bubble_max_width = width - avatar_size - 54
        text_width = bubble_max_width - 22
        lines = base.wrap_text(text, "NotoSC", text_size, text_width)
        if len(lines) > 3:
            raise ValueError(f"v15 chat bubble overflows three lines: {speaker}: {text}")
        bubble_width = min(
            bubble_max_width,
            max(84, max(base.pdfmetrics.stringWidth(line, "NotoSC", text_size) for line in lines) + 22),
        )
        bubble_height = 8 + len(lines) * leading
        bubble_top = y + height - 12
        bubble_y = bubble_top - bubble_height
        if bubble_y < y:
            raise ValueError(f"v15 chat row too short: {speaker}: {text}")
        if is_learner:
            bubble_x = avatar_x - 11 - bubble_width
            name_x = bubble_x + bubble_width
        else:
            bubble_x = avatar_x + avatar_size + 11
            name_x = bubble_x

        c.saveState()
        c.drawImage(str(self.chat_avatars[speaker]), avatar_x, avatar_y, avatar_size, avatar_size, mask="auto")
        c.setStrokeColor(colors.white)
        c.setLineWidth(1.0)
        c.circle(avatar_x + avatar_size / 2, avatar_y + avatar_size / 2, avatar_size / 2, fill=0, stroke=1)
        c.setFillColor(SOURCE.v11.CHAT_NAME)
        c.setFont("NotoSC", 7.7)
        if is_learner:
            c.drawRightString(name_x, y + height - 6, label)
        else:
            c.drawString(name_x, y + height - 6, label)
        bubble_color = SOURCE.v11.CHAT_RIGHT if is_learner else SOURCE.v11.CHAT_LEFT
        c.setFillColor(bubble_color)
        c.setStrokeColor(SOURCE.v11.CHAT_RIGHT if is_learner else SOURCE.v11.CHAT_BORDER)
        c.setLineWidth(0.5)
        c.roundRect(bubble_x, bubble_y, bubble_width, bubble_height, 5, fill=1, stroke=1)
        tail = c.beginPath()
        if is_learner:
            tail.moveTo(bubble_x + bubble_width, bubble_top - 7)
            tail.lineTo(bubble_x + bubble_width + 7, bubble_top - 11)
            tail.lineTo(bubble_x + bubble_width, bubble_top - 16)
        else:
            tail.moveTo(bubble_x, bubble_top - 7)
            tail.lineTo(bubble_x - 7, bubble_top - 11)
            tail.lineTo(bubble_x, bubble_top - 16)
        tail.close()
        c.drawPath(tail, fill=1, stroke=0)
        c.setFillColor(SOURCE.v11.CHAT_TEXT)
        c.setFont("NotoSC", text_size)
        text_y = bubble_top - 12
        for line in lines:
            c.drawString(bubble_x + 11, text_y, line)
            text_y -= leading
        c.restoreState()

    def _draw_opening(self, paragraphs: list[str], top: float, field: str) -> float:
        line_counts = [len(base.wrap_text(text, "NotoSC", 8.9, 410)) for text in paragraphs]
        if any(count > 3 for count in line_counts):
            raise ValueError(f"{field} paragraph exceeds three lines")
        height = 27 + sum(line_counts) * 12.2 + 4
        bottom = top - height
        c = self.canvas
        c.setFillColor(colors.HexColor("#F4E7E0"))
        c.roundRect(42, bottom, 511, height, 5, fill=1, stroke=0)
        c.setFillColor(base.CINNABAR)
        c.setFont("NotoSCBold", 9.2)
        c.drawString(55, top - 19, "闯祸现场")
        y = top - 18
        for paragraph, count in zip(paragraphs, line_counts, strict=True):
            self.draw_text_exact(
                paragraph, 126, y, 410, size=8.9, leading=12.2, color=base.INK,
                max_lines=3, field=field,
            )
            y -= count * 12.2 + 4
        return bottom

    def _draw_story_page(
        self, *, chapter_index: int, number: int | None, title: str, goal: str | None,
        story: dict, bookmark: str, outline_level: int, accent,
    ) -> None:
        self.begin(background=base.PAPER)
        self.layout_changed_pages.append(self.page)
        section = f"第 {chapter_index:02d} 章" if number is None else f"第 {chapter_index:02d} 章 · 章内续问"
        self.header(section)
        self.canvas.bookmarkPage(bookmark)
        self.canvas.addOutlineEntry(title, bookmark, level=outline_level, closed=False)
        label = f"第 {chapter_index:02d} 场 · 闯祸与群聊" if number is None else f"章内续问 {chapter_index}.{number} · 闯祸与群聊"
        self.section_label(label, 42, base.PAGE_H - 78, accent=accent)
        title_bottom = self.title(title, 42, base.PAGE_H - 108, size=22.0)
        y = title_bottom - 2
        if goal:
            goal_lines = len(base.wrap_text("目标：" + goal, "NotoSC", 9.7, 500))
            self.draw_text_exact(
                "目标：" + goal, 42, y, 500, size=9.7, leading=14.0, color=base.BLUE,
                max_lines=2, field=f"chapter {chapter_index} goal",
            )
            y -= goal_lines * 14.0 + 8
        opening_bottom = self._draw_opening(story["opening"], min(666, y), f"{bookmark} opening")

        turns = story["dialogue"]
        row_height = {4: 72, 5: 66, 6: 60}[len(turns)]
        gap = 2
        dialogue_top = opening_bottom - 9
        dialogue_bottom = dialogue_top - len(turns) * row_height - (len(turns) - 1) * gap
        c = self.canvas
        c.setFillColor(SOURCE.v11.CHAT_BG)
        c.roundRect(42, dialogue_bottom - 4, 511, dialogue_top - dialogue_bottom + 8, 6, fill=1, stroke=0)
        for slot, (speaker, text) in enumerate(turns):
            row_y = dialogue_top - row_height - slot * (row_height + gap)
            self.compact_avatar_band(speaker, text, 50, row_y, 495, row_height)

        closing_top = dialogue_bottom - 10
        closing_lines = len(base.wrap_text(story["closing"], "NotoSCBold", 9.3, 418))
        closing_height = 25 + closing_lines * 13.0
        closing_bottom = closing_top - closing_height
        if closing_bottom < 42:
            raise ValueError(f"{bookmark} story page violates footer safe area: {closing_bottom:.1f}")
        c.setFillColor(colors.HexColor("#E6EFEC"))
        c.roundRect(42, closing_bottom, 511, closing_height, 5, fill=1, stroke=0)
        c.setFillColor(base.BLUE)
        c.setFont("NotoSCBold", 9.2)
        c.drawString(56, closing_top - 18, "收束")
        self.draw_text_exact(
            story["closing"], 109, closing_top - 18, 427, font="NotoSCBold",
            size=9.3, leading=13.0, color=base.INK, max_lines=2, field=f"{bookmark} closing",
        )
        self.end()

    def chapter_dialogue(self, chapter: dict, index: int) -> None:
        self._draw_story_page(
            chapter_index=index, number=None, title=chapter["title"], goal=chapter["goal"],
            story=self.stories["chapters"][str(index)], bookmark=f"chapter-{index}",
            outline_level=1, accent=base.CINNABAR,
        )

    def supplement_dialogue_page(self, item: dict, chapter_index: int, number: int) -> None:
        _, accent = SOURCE.v11.v10.SOURCE_LABELS[item["source"]]
        self._draw_story_page(
            chapter_index=chapter_index, number=number, title=item["title"], goal=None,
            story=self.stories["supplements"][item["id"]], bookmark=f"supplement-{item['id']}",
            outline_level=2, accent=accent,
        )

    def _draw_text_card(self, label: str, text: str, top: float, fill, accent, field: str) -> float:
        lines = len(base.wrap_text(text, "NotoSC", 9.6, 462))
        if lines > 4:
            raise ValueError(f"{field} exceeds four lines")
        height = 31 + lines * 13.6
        bottom = top - height
        c = self.canvas
        c.setFillColor(fill)
        c.roundRect(42, bottom, 511, height, 5, fill=1, stroke=0)
        c.setFillColor(accent)
        c.setFont("NotoSCBold", 9.5)
        c.drawString(56, top - 19, label)
        self.draw_text_exact(
            text, 56, top - 38, 478, size=9.6, leading=13.6, color=base.INK,
            max_lines=4, field=field,
        )
        return bottom

    def _draw_two_column_rows(
        self, entries: list[str], top: float, *, row_height: float, field: str,
    ) -> float:
        rows = max(1, math.ceil(len(entries) / 2))
        for index, text in enumerate(entries):
            column = index % 2
            row = index // 2
            x = 42 + column * 259
            y_top = top - row * row_height
            self.canvas.setFillColor(colors.HexColor("#F7F5F1"))
            self.canvas.roundRect(x, y_top - row_height + 3, 252, row_height - 5, 4, fill=1, stroke=0)
            self.canvas.setFillColor(base.BLUE if column == 0 else base.CINNABAR)
            self.canvas.circle(x + 14, y_top - 15, 2.6, fill=1, stroke=0)
            self.draw_text_exact(
                text, x + 24, y_top - 11, 215, size=8.8, leading=11.7,
                color=base.INK, max_lines=2, field=f"{field} {index + 1}",
            )
        return top - rows * row_height

    def eli5_explainer_page(
        self, *, chapter_index: int, number: int | None, title: str, cue: str,
        analogy: str, glossary: list[tuple[str, str]], guides: list[str], next_hook: str,
        accent,
    ) -> None:
        self.begin(background=base.WHITE)
        self.layout_changed_pages.append(self.page)
        suffix = "直觉解释层" if number is None else f"补充 {chapter_index}.{number} · 直觉解释层"
        self.header(f"第 {chapter_index:02d} 章 · {suffix}")
        self.section_label("先有画面，再落到工程", 42, base.PAGE_H - 78, accent=accent)
        title_bottom = self.title(title, 42, base.PAGE_H - 108, size=21.0)
        y = self._draw_text_card(
            "先懂一句", text_model.strip_cue(cue), title_bottom - 7,
            colors.HexColor("#E6EFEC"), base.BLUE, f"eli5 {chapter_index}.{number} cue",
        ) - 8
        y = self._draw_text_card(
            "直觉类比", analogy, y, colors.HexColor("#F4E7E0"), base.CINNABAR,
            f"eli5 {chapter_index}.{number} analogy",
        ) - 20

        self.section_label("术语落地", 42, y, accent=base.BLUE)
        glossary_entries = [f"{term}：{gloss}" for term, gloss in glossary]
        if not glossary_entries:
            glossary_entries = ["本节没有必须先背的新黑话，先沿着事故和代码往下走。"]
        y = self._draw_two_column_rows(
            glossary_entries, y - 23, row_height=34, field=f"eli5 {chapter_index}.{number} glossary",
        ) - 13

        self.section_label("读代码抓手", 42, y, accent=base.OCHRE)
        y = self._draw_two_column_rows(
            guides, y - 23, row_height=34, field=f"eli5 {chapter_index}.{number} guide",
        ) - 9
        route = "接下来先拆去比喻，核对本单元的技术真相、代码、失败路径和验收证据。"
        next_lines = len(base.wrap_text(route, "NotoSC", 9.3, 430))
        footer_height = 23 + next_lines * 12.8
        footer_bottom = y - footer_height
        if footer_bottom < 42:
            raise ValueError(
                f"eli5 {chapter_index}.{number} violates footer safe area: {footer_bottom:.1f}"
            )
        self.canvas.setFillColor(colors.HexColor("#EEF2F0"))
        self.canvas.roundRect(42, footer_bottom, 511, footer_height, 5, fill=1, stroke=0)
        self.canvas.setFillColor(base.BLUE)
        self.canvas.setFont("NotoSCBold", 9.2)
        self.canvas.drawString(56, y - 17, "本节路线")
        self.draw_text_exact(
            route, 109, y - 17, 427, size=9.3, leading=12.8, color=base.INK,
            max_lines=3, field=f"eli5 {chapter_index}.{number} next",
        )
        self.end()

    def chapter_eli5_page(self, chapter: dict, index: int) -> None:
        parts = chapter["principles"] + chapter["pitfalls"] + [
            chapter["goal"], chapter["task"], chapter["accept"],
        ]
        glossary = text_model.chapter_glossary(index, parts)
        if index == 19:
            glossary = [
                ("任务身份", "Run 管整趟目标；Step 管当前动作"),
                ("重试身份", "CallID 固定；AttemptID 每次尝试可变"),
                ("结果状态", "receipt 证明结果；Unknown 表示仍待对账"),
                ("控制资源", "approval 放行动作；budget/reservation 先占后结算"),
            ]
        elif index == 21:
            glossary = [
                ("可信主体", "Principal 来自认证；tenant 划分数据边界"),
                ("许可凭据", "approval 人工放行；capability 限定能做什么"),
                ("资源控制", "budget 限消耗；reservation 先占额度再结算"),
                ("执行边界", "sandbox 限权限与资源；Tool 才真正产生副作用"),
            ]
        elif index == 24:
            glossary = [
                ("入口身份", "tenant、owner 与 entry key 决定请求作用域"),
                ("执行身份", "Run/Step 记录目标与动作，CallID 固定副作用"),
                ("结果证据", "receipt 与 outbox 证明结果和事件都已落地"),
                ("恢复规则", "Unknown 先对账，重复调用不能再落一笔"),
            ]
        guides = text_model.code_reading_guide(chapter["code"])
        if index == 18:
            guides = [
                "先比 name、sideEffect 与 requiresApproval：谁只做草稿，谁真的写账。",
                "再看 input/output schema 摘要：陌生字段、长度和结果形状由哪个版本裁决。",
                "幂等身份必须来自 Harness CallID，不能让模型在参数里自报一个 key。",
                "最后把 contract digest 与审批快照绑定，热更新不能偷换已批准契约。",
            ]
        elif index == 19:
            guides = [
                "先看 Run、Step、Attempt、Approval 四个 struct：各自保存哪一段生命周期。",
                "Fence 只是单调递增的 uint64 命名类型，没有字段；它用来拒绝旧写回。",
                "再找稳定与变化：Step.CallID 固定，Attempt.ID 每次物理尝试可以变化。",
                "最后沿状态出口核对：Unknown 先对账，终态不被迟到结果改写。",
            ]
        self.eli5_explainer_page(
            chapter_index=index, number=None, title=chapter["title"], cue=chapter["mnemonic"],
            analogy=text_model.CHAPTER_ANALOGIES[index],
            glossary=glossary,
            guides=guides,
            next_hook=chapter["transition_out"], accent=base.CINNABAR,
        )

    def supplement_eli5_page(self, item: dict, chapter_index: int, number: int) -> None:
        _, accent = SOURCE.v11.v10.SOURCE_LABELS[item["source"]]
        parts = item["bullets"] + [item["exercise"], item["acceptance"]]
        guides = text_model.code_reading_guide(item["code"]) if item.get("code") else [
            f"设计练习 {chapter_index}.{number}：提交状态表、测试矩阵、命令输出或验收证据。",
            "本节不提供可运行实现，不用漂亮伪代码冒充实验结果。",
        ]
        self.eli5_explainer_page(
            chapter_index=chapter_index, number=number, title=item["title"], cue=item["kicker"],
            analogy=text_model.supplement_analogy(item), glossary=text_model.glossary_for(parts),
            guides=guides, next_hook=item["next_hook"], accent=accent,
        )

    def _build_supplement(self, item: dict, chapter_index: int, number: int) -> None:
        self.supplement_dialogue_page(item, chapter_index, number)
        self.supplement_eli5_page(item, chapter_index, number)
        self.supplement_technical_page(item, chapter_index, number)
        chunks = SOURCE.v11.v10.supplement_code_chunks(item)
        for chunk_index, chunk in enumerate(chunks, 1):
            self.supplement_code_page(item, chapter_index, number, chunk, chunk_index, len(chunks))

    def chapter_code_chunk_page(
        self, chapter: dict, index: int, chunk: list[str], chunk_index: int, chunk_total: int,
    ) -> None:
        self.begin(background=base.WHITE)
        self.header(f"第 {index:02d} 章 · 代码骨架")
        self.section_label(
            f"代码完整展开 {chunk_index}/{chunk_total}", 42, base.PAGE_H - 80, accent=base.BLUE,
        )
        title_bottom = self.title("保持字号，按安全行数拆页", 42, base.PAGE_H - 112, size=22.0)
        self.draw_text_exact(
            chapter["mnemonic"], 42, title_bottom - 1, 500,
            size=9.8, leading=14.8, color=base.MUTED, max_lines=2,
            field=f"chapter {index} code cue",
        )

        block_top = min(665, title_bottom - 43)
        line_height = 15.0
        block_height = len(chunk) * line_height + 42
        block_bottom = block_top - block_height
        if block_bottom < 112:
            raise ValueError(f"chapter code chunk too tall: {index} {chunk_index}")
        self.canvas.setFillColor(base.CODE_BG)
        self.canvas.roundRect(42, block_bottom, 511, block_height, 6, fill=1, stroke=0)
        y = block_top - 27
        line_offset = (chunk_index - 1) * 32
        for local_index, line in enumerate(chunk, 1):
            self.canvas.setFillColor(base.CODE_LINE_NO)
            self.canvas.setFont("CodeMono", 8.5)
            self.canvas.drawRightString(70, y, f"{line_offset + local_index:02d}")
            base.draw_go_code_line(self.canvas, line, 82, y, size=10.0)
            y -= line_height

        self.canvas.setFillColor(colors.HexColor("#E6EFEC"))
        self.canvas.roundRect(42, 72, 511, 52, 5, fill=1, stroke=0)
        continuation = (
            "下一页继续同一段代码，最后一页再统一核对失败路径与验收证据。"
            if chunk_index < chunk_total
            else "代码到此完整展开；下一页统一核对失败路径、任务、证据与自检。"
        )
        self.draw_text_exact(
            continuation, 58, 105, 478, font="NotoSCBold", size=9.7, leading=14.2,
            color=base.BLUE, max_lines=2, field=f"chapter {index} code continuation",
        )
        self.end()

    def code_page(self, chapter: dict, index: int) -> None:
        code_lines = chapter["code"].strip().splitlines()
        if len(code_lines) <= 38:
            super().code_page(chapter, index)
            return
        chunks = [code_lines[start:start + 32] for start in range(0, len(code_lines), 32)]
        for chunk_index, chunk in enumerate(chunks, 1):
            self.chapter_code_chunk_page(chapter, index, chunk, chunk_index, len(chunks))
        self.acceptance_page(chapter, index)

    def build(self) -> None:
        self.cover()
        self.character_manifesto()
        self.toc(1, 8, "目录卷一：Go 从一行走到并发")
        self.toc(9, 16, "目录卷二：后端从请求走到上线")
        self.toc(17, 24, "目录卷三：Harness 管住模型不确定性")
        self.learning_map()
        volume_index = 0
        seen_diagrams = set()
        for index, chapter in enumerate(CHAPTERS, 1):
            if index in VOLUMES:
                volume_index += 1
                self.volume(index, volume_index)
            self.chapter_dialogue(chapter, index)
            self.chapter_eli5_page(chapter, index)
            supplements = SUPPLEMENTS_BY_CHAPTER[index]
            if index == 18:
                for number, item in enumerate(supplements, 1):
                    self._build_supplement(item, index, number)
            for diagram_index, slug in enumerate(chapter["diagrams"], 1):
                original_title = base.DIAGRAM_TITLES.get(slug)
                if slug in seen_diagrams and original_title:
                    base.DIAGRAM_TITLES[slug] = f"回顾 · {original_title}"
                try:
                    self.diagram_page(chapter, index, slug, diagram_index, len(chapter["diagrams"]))
                finally:
                    if original_title:
                        base.DIAGRAM_TITLES[slug] = original_title
                seen_diagrams.add(slug)
            self.code_page(chapter, index)
            if index != 18:
                for number, item in enumerate(supplements, 1):
                    self._build_supplement(item, index, number)
            self.self_check_answer_page(chapter, index)
        self.appendix()
        self.appendix_evidence()
        self.canvas.save()
        print(self.output)
        print(f"pages={self.page}")

    def build_pilot(self) -> None:
        self.canvas.bookmarkPage("pilot")
        self.canvas.addOutlineEntry("v15 故事与 ELI5 排版样页", "pilot", level=0, closed=False)
        for index in (1, 2):
            self.chapter_dialogue(CHAPTERS[index - 1], index)
            self.chapter_eli5_page(CHAPTERS[index - 1], index)
        item = next(item for item in SUPPLEMENTS if item["id"] == "harness-handler-worker-skeleton")
        number = SUPPLEMENTS_BY_CHAPTER[item["chapter"]].index(item) + 1
        self.supplement_dialogue_page(item, item["chapter"], number)
        self.supplement_eli5_page(item, item["chapter"], number)
        self.canvas.save()
        print(self.output)
        print(f"pages={self.page}")


def prepare_assets() -> dict[str, object]:
    assets = SOURCE.prepare_assets()
    assets["asset_master_rebuilds"] = 0
    return assets


def write_preflight(assets: dict[str, object], mode: str) -> None:
    payload = {
        "version": "15.0.0",
        "mode": mode,
        "chapters": len(CHAPTERS),
        "supplements": len(SUPPLEMENTS),
        "story_dialogue_turns": STORY_MANIFEST["story_dialogue_turns"],
        "image_api_calls": 0,
        "asset_master_rebuilds": assets["asset_master_rebuilds"],
        "avatar_crop_default": DEFAULT_CROP,
        "zhou_mili_source": str(ZHOU_MILI_SOURCE.relative_to(ROOT)),
        "zhou_mili_crop": ZHOU_MILI_CROP,
        "output": str((PILOT_OUT if mode == "pilot" else OUT).relative_to(ROOT)),
    }
    PREFLIGHT.parent.mkdir(parents=True, exist_ok=True)
    PREFLIGHT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pilot", action="store_true")
    args = parser.parse_args()
    output = PILOT_OUT if args.pilot else OUT
    output.parent.mkdir(parents=True, exist_ok=True)
    assets = prepare_assets()
    write_preflight(assets, "pilot" if args.pilot else "full")
    book = BookV15(output, assets)
    if args.pilot:
        book.build_pilot()
    else:
        book.build()


if __name__ == "__main__":
    main()
