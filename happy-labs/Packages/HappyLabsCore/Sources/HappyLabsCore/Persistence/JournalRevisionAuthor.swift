import Foundation

/// Who authored a journal revision.
///
/// Journal text is revisable interpretation; Morningstar captures are sealed
/// witness. Divergence between the two is only meaningful if you can tell
/// *the human reconsidered* from *an instrument rewrote it*. That distinction
/// is what this records.
///
/// Attribution is recorded, never enforced. An agent-authored revision may be
/// entirely correct. The requirement is that it be distinguishable.
///
/// Absence is meaningful and is represented by `nil` rather than a case here:
/// a revision written before this field existed is *unattributed*, and must
/// never be read as `human`.
public enum JournalRevisionAuthor: String, CaseIterable, Sendable {
    /// An explicit human decision — the editor accepted, edited, or rejected.
    case human

    /// Drafted or edited by an instrument, however closely supervised.
    case agent

    /// Mechanical. Produced by import with no interpretive act — the baseline
    /// snapshot of an entry as it arrived, before anyone decided anything.
    case pipeline
}
