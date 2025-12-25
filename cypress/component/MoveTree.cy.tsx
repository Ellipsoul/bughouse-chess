import MoveTree from "../../app/components/MoveTree";
import type { AnalysisTree } from "../../app/types/analysis";
import { createInitialPositionSnapshot } from "../../app/utils/analysis/applyMove";

describe("MoveTree", () => {
  const createTreeWithMoves = (): AnalysisTree => {
    const rootPosition = createInitialPositionSnapshot();
    const afterE4 = createInitialPositionSnapshot();
    const afterE5 = createInitialPositionSnapshot();

    return {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: rootPosition,
          children: ["move1"],
          mainChildId: "move1",
        },
        move1: {
          id: "move1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: afterE4,
          children: ["move2", "var1"],
          mainChildId: "move2",
        },
        move2: {
          id: "move2",
          parentId: "move1",
          incomingMove: {
            board: "A",
            side: "black",
            kind: "normal",
            san: "e5",
            key: "A:normal:e7-e5",
            normal: { from: "e7", to: "e5" },
          },
          position: afterE5,
          children: [],
          mainChildId: null,
        },
        var1: {
          id: "var1",
          parentId: "move1",
          incomingMove: {
            board: "A",
            side: "black",
            kind: "normal",
            san: "c5",
            key: "A:normal:c7-c5",
            normal: { from: "c7", to: "c5" },
          },
          position: afterE4,
          children: [],
          mainChildId: null,
        },
      },
    };
  };

  const createDefaultProps = () => ({
    tree: createTreeWithMoves(),
    cursorNodeId: "root",
    selectedNodeId: "root",
    onSelectNode: cy.stub().as("onSelectNode"),
    onPromoteVariationOneLevel: cy.stub().as("onPromoteVariationOneLevel"),
    onTruncateAfterNode: cy.stub().as("onTruncateAfterNode"),
    onTruncateFromNodeInclusive: cy.stub().as("onTruncateFromNodeInclusive"),
  });

  it("renders mainline moves", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} />);
    cy.contains("e4").should("exist");
    cy.contains("e5").should("exist");
  });

  it("renders variations in parentheses", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} />);
    // Variation should be rendered
    cy.contains("c5").should("exist");
  });

  it("enables promote button when variation is selected", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="var1" />);
    cy.contains("Promote").should("not.be.disabled");
  });

  it("disables promote button when mainline is selected", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="move1" />);
    cy.contains("Promote").should("be.disabled");
  });

  it("enables truncate buttons when node has children", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="move1" />);
    cy.contains("Delete after here").should("not.be.disabled");
    cy.contains("Delete from here").should("not.be.disabled");
  });

  it("disables truncate buttons for root node", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="root" />);
    cy.contains("Delete after here").should("be.disabled");
    cy.contains("Delete from here").should("be.disabled");
  });

  it("calls onSelectNode when move is clicked", () => {
    const defaultProps = createDefaultProps();
    const onSelectNode = defaultProps.onSelectNode;
    cy.mount(<MoveTree {...defaultProps} onSelectNode={onSelectNode} />);

    cy.contains("e4").click().then(() => {
      expect(onSelectNode).to.have.been.calledWith("move1");
    });
  });

  it("calls onPromoteVariationOneLevel when promote button is clicked", () => {
    const defaultProps = createDefaultProps();
    const onPromote = defaultProps.onPromoteVariationOneLevel;
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="var1" onPromoteVariationOneLevel={onPromote} />);

    cy.contains("Promote").click().then(() => {
      expect(onPromote).to.have.been.calledWith("var1");
    });
  });

  it("highlights cursor node", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} cursorNodeId="move1" />);
    // Cursor node should have ring styling
    cy.contains("e4").parent().should("have.class", "ring-1");
  });

  it("highlights selected node", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveTree {...defaultProps} selectedNodeId="move1" />);
    // Selected node should have amber background
    cy.contains("e4").parent().should("have.class", "bg-amber-200/15");
  });
});
