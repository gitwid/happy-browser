import HappyLabsCore
import SwiftUI

struct ConnectomeView: View {
    let graph: ConnectomeGraph
    let onBack: () -> Void
    let onOpen: (UUID) -> Void

    @State private var hoveredID: UUID?
    @State private var selectedID: UUID?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onBack) {
                HStack(spacing: 8) {
                    Text("‹")
                        .font(.system(size: 18, weight: .regular))
                    Text("JOURNAL")
                        .font(JournalTheme.capsLabel(10.5))
                        .tracking(2.4)
                }
                .foregroundStyle(JournalTheme.label)
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)

            Text("THE CONNECTOME")
                .font(JournalTheme.capsLabel(11))
                .tracking(3.2)
                .foregroundStyle(JournalTheme.label)
                .padding(.top, 8)

            Text("The Connectome")
                .font(JournalTheme.newsreader(46, weight: .light))
                .foregroundStyle(JournalTheme.ink)
                .padding(.top, 18)

            Text("Every message you imported, traced to its root and gathered into the few that became stories.")
                .font(.system(size: 13.5))
                .foregroundStyle(JournalTheme.muted)
                .lineSpacing(4)
                .padding(.top, 12)
                .frame(maxWidth: 36 * 12, alignment: .leading)

            Text(graph.countLine)
                .font(JournalTheme.mono(11))
                .foregroundStyle(JournalTheme.label)
                .padding(.top, 14)

            if graph.displayedEntryCount < graph.totalEntryCount {
                Text("Showing the \(graph.displayedEntryCount) most recent clusters. Open the journal for the full list.")
                    .font(.system(size: 12))
                    .foregroundStyle(JournalTheme.muted)
                    .padding(.top, 8)
            }

            GeometryReader { proxy in
                let scale = min(
                    proxy.size.width / ConnectomeGraphBuilder.layoutSize.width,
                    proxy.size.height / ConnectomeGraphBuilder.layoutSize.height
                )
                let offsetX = (proxy.size.width - ConnectomeGraphBuilder.layoutSize.width * scale) / 2
                let offsetY = (proxy.size.height - ConnectomeGraphBuilder.layoutSize.height * scale) / 2

                ZStack {
                    ConnectomeCanvas(
                        graph: graph,
                        hoveredID: hoveredID,
                        selectedID: selectedID
                    )
                    .scaleEffect(scale, anchor: .topLeading)
                    .offset(x: offsetX, y: offsetY)

                    ForEach(graph.nodes) { node in
                        let threadPoint = scaled(node.threadPosition, scale: scale, offsetX: offsetX, offsetY: offsetY)
                        Circle()
                            .fill(Color.clear)
                            .frame(width: 28 * scale, height: 28 * scale)
                            .contentShape(Circle())
                            .position(threadPoint)
                            .onTapGesture {
                                selectedID = node.id
                            }
                            .onHover { hovering in
                                hoveredID = hovering ? node.id : (hoveredID == node.id ? nil : hoveredID)
                            }
                    }
                }
            }
            .frame(height: 380)
            .padding(.top, 24)

            Text("Tap a cluster to open its entry")
                .font(.system(size: 11))
                .foregroundStyle(JournalTheme.mutedLight)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)

            if let selectedID, let node = graph.nodes.first(where: { $0.id == selectedID }) {
                ConnectomeSelectionSheet(
                    node: node,
                    onOpen: { onOpen(selectedID) },
                    onDismiss: { self.selectedID = nil }
                )
                .padding(.top, 28)
            }
        }
        .frame(maxWidth: JournalTheme.contentMaxWidth, alignment: .leading)
        .padding(.top, 84)
    }

    private func scaled(_ point: CGPoint, scale: CGFloat, offsetX: CGFloat, offsetY: CGFloat) -> CGPoint {
        CGPoint(x: point.x * scale + offsetX, y: point.y * scale + offsetY)
    }
}

private struct ConnectomeCanvas: View {
    let graph: ConnectomeGraph
    let hoveredID: UUID?
    let selectedID: UUID?

    var body: some View {
        Canvas { context, _ in
            for node in graph.nodes {
                guard let origin = graph.originPosition(for: node.originID) else { continue }
                var edge = Path()
                edge.move(to: origin)
                edge.addLine(to: node.threadPosition)
                let faded = selectedID != nil && selectedID != node.id
                context.stroke(
                    edge,
                    with: .color(JournalTheme.divider.opacity(faded ? 0.35 : 0.7)),
                    lineWidth: faded ? 0.6 : 0.9
                )
            }

            if let selectedID, let node = graph.nodes.first(where: { $0.id == selectedID }),
               let origin = graph.originPosition(for: node.originID) {
                var focus = Path()
                focus.move(to: origin)
                focus.addLine(to: node.threadPosition)
                focus.addLine(to: node.entryPosition)
                context.stroke(focus, with: .color(JournalTheme.accent.opacity(0.85)), lineWidth: 1.4)
            }

            for node in graph.nodes {
                let isActive = node.id == hoveredID || node.id == selectedID
                let threadRect = CGRect(x: node.threadPosition.x - 5, y: node.threadPosition.y - 5, width: 10, height: 10)
                context.fill(
                    Path(ellipseIn: threadRect),
                    with: .color(isActive ? JournalTheme.accent : JournalTheme.ink.opacity(0.55))
                )
                let entryRect = CGRect(x: node.entryPosition.x - 3.5, y: node.entryPosition.y - 3.5, width: 7, height: 7)
                context.stroke(
                    Path(ellipseIn: entryRect),
                    with: .color(isActive ? JournalTheme.accent : JournalTheme.muted),
                    lineWidth: 1.2
                )
            }

            for origin in graph.origins {
                let originOuter = CGRect(x: origin.position.x - 13, y: origin.position.y - 13, width: 26, height: 26)
                context.fill(Path(ellipseIn: originOuter), with: .color(Color(red: 0.86, green: 0.87, blue: 0.89)))
                context.stroke(
                    Path(ellipseIn: originOuter),
                    with: .color(Color(red: 0.47, green: 0.48, blue: 0.51).opacity(0.6)),
                    lineWidth: 1
                )
                let originInner = CGRect(x: origin.position.x - 4.5, y: origin.position.y - 4.5, width: 9, height: 9)
                context.fill(Path(ellipseIn: originInner), with: .color(JournalTheme.accent))
            }
        }
        .frame(
            width: ConnectomeGraphBuilder.layoutSize.width,
            height: ConnectomeGraphBuilder.layoutSize.height
        )
        .overlay(alignment: .bottom) {
            Text(graph.originCaption)
                .font(JournalTheme.mono(10))
                .foregroundStyle(JournalTheme.label)
                .offset(y: 18)
        }
    }
}

private struct ConnectomeSelectionSheet: View {
    let node: ConnectomeGraph.Node
    let onOpen: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(statusLabel)
                    .font(JournalTheme.capsLabel(10))
                    .tracking(1.6)
                    .foregroundStyle(JournalTheme.accent)
                Spacer()
                Button("Close", action: onDismiss)
                    .buttonStyle(.plain)
                    .font(.system(size: 12))
                    .foregroundStyle(JournalTheme.muted)
            }
            Text(node.title)
                .font(JournalTheme.newsreader(22, weight: .regular))
                .foregroundStyle(JournalTheme.ink)
            Text("\(node.messageCount) message\(node.messageCount == 1 ? "" : "s") in thread")
                .font(.system(size: 12.5))
                .foregroundStyle(JournalTheme.muted)
            Button(action: onOpen) {
                Text("Open journal entry")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(JournalTheme.paper)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(JournalTheme.ink)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .background(JournalTheme.paper.opacity(0.92))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(JournalTheme.divider, lineWidth: 1)
        )
    }

    private var statusLabel: String {
        switch node.status {
        case .archived: return "ARCHIVED"
        case .retained: return "KEPT"
        case .discarded: return "DISCARDED"
        case .draft: return "IN REVIEW"
        }
    }
}
