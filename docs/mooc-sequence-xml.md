# FreeCut 慕课序列 XML 1.0

这是 FreeCut 自己的课程序列交换格式，版本 `1.0`。

它不是 Final Cut Pro XML，也不是 Premiere Pro 的 XMEML / FCP7 XML，更不是 AAF。把这个文件交给 Premiere 或 Final Cut 不会得到一条可编辑的成片时间线。FreeCut 导入它时，只还原下面写明的字段，然后编译成 FreeCut 自己的时间线，供现有预览和 WebCodecs 导出使用。

## 时间

- 单位是秒，写在主时间轴上。
- 片头占据 `[0, intro.duration)`。
- 字幕块的 `start` / `end` 已经包含片头偏移。旁白 SRT 里的 0 秒，导入后会变成 `intro.duration`。
- 每个字幕块是半开区间 `[start, end)`，同一时刻只有一个机位。
- 相邻字幕可以首尾相接。中间留白会保留，留白处没有机位。
- 片尾从最后一条字幕的 `end` 开始，长度为 `outro.duration`。
- 不接受非有限数字、负数、结束早于或等于开始、重叠、重复 id，以及和片头重叠的字幕。

## 根元素

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mooc version="1.0" title="课程标题">
  <packaging>...</packaging>
  <assets>...</assets>
  <sequence>...</sequence>
</mooc>
```

`version` 只能是 `1.0`。`title` 必填。未在本文列出的属性和子元素都会导致整份文件被拒绝。

## packaging

```xml
<packaging>
  <intro duration="8.000" title="标题" subtitle="副标题" mediaRef="可选的素材 id" sample="false"/>
  <outro duration="6.000" title="感谢收看" subtitle="副标题" sample="true"/>
</packaging>
```

- `duration` 是非负的十进制秒，不能写成科学计数法。
- `mediaRef` 是 FreeCut 素材库里的 id，不是文件路径。省略表示用标题文字叠在共享背景上。
- `sample="true"` 只是编辑器里的示例标记，不是播放指令。

## assets

```xml
<assets>
  <audio mediaRef="旁白素材 id" sample="false"/>
  <lecturer mediaRef="讲师素材 id" kind="video" sample="false"/>
  <background mediaRef="背景图 id" sample="true"/>
  <slide index="0" label="课件名" mediaRef="图片 id" sample="false"/>
</assets>
```

- `lecturer` 的 `kind` 只能是 `video` 或 `image`。有 `mediaRef` 时必须写 `kind`。
- `kind="image"` 表示静帧，预览不会把它当成视频播放。
- `slide` 的 `index` 必须从 0 连续编号。
- 素材 id 在另一台机器上不存在时，导入仍会成功，编译时会标明缺少素材，不会假装已经播出来。

## sequence

```xml
<sequence>
  <cue id="b1" start="8.000" end="15.200" camera="half" slide="0">
    <subtitle>字幕文本</subtitle>
  </cue>
</sequence>
```

- `camera` 只能是 `ppt`（纯 PPT）、`pip`（大课件 + 人像小窗）、`half`（课件 + 讲师半身）。
- 一个 `cue` 只有一个 `camera`。没有第二个机位字段。
- `slide` 指向 `assets` 里的课件序号。
- `subtitle` 只含文本。`<`、`>`、`&`、引号会按 XML 转义。

## 和成片的关系

导出这个 XML 不会渲染视频。视频导出用 FreeCut 现有的导出对话框，导出的是编译后的时间线（背景、课件、讲师、字幕、旁白、片头片尾）。编译做的是硬切，没有机位间转场。
