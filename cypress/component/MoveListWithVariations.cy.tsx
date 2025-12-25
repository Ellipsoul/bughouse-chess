import MoveListWithVariations from "../../app/components/MoveListWithVariations";
import type { AnalysisTree } from "../../app/types/analysis";
import type { BughouseMove } from "../../app/types/bughouse";
import { createInitialPositionSnapshot } from "../../app/utils/analysis/applyMove";

describe("MoveListWithVariations", () => {
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

  const defaultPlayers = {
    aWhite: { username: "Player1" },
    aBlack: { username: "Player2" },
    bWhite: { username: "Player3" },
    bBlack: { username: "Player4" },
  };

  const createDefaultProps = () => ({
    tree: createTreeWithMoves(),
    cursorNodeId: "root",
    selectedNodeId: "root",
    players: defaultPlayers,
    onSelectNode: cy.stub().as("onSelectNode"),
    onPromoteVariationOneLevel: cy.stub().as("onPromoteVariationOneLevel"),
    onTruncateAfterNode: cy.stub().as("onTruncateAfterNode"),
    onTruncateFromNodeInclusive: cy.stub().as("onTruncateFromNodeInclusive"),
  });

  it("renders mainline moves in table", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveListWithVariations {...defaultProps} />);
    cy.contains("e4").should("exist");
    cy.contains("e5").should("exist");
  });

  it("renders variations below mainline moves", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveListWithVariations {...defaultProps} />);
    // Variation should be rendered
    cy.contains("c5").should("exist");
  });

  it("formats move times when provided", () => {
    const defaultProps = createDefaultProps();
    const combinedMoves: BughouseMove[] = [
      {
        board: "A",
        moveNumber: 1,
        move: "e4",
        timestamp: 5,
        side: "white",
      },
    ];
    const combinedMoveDurations = [5]; // 0.5 seconds

    cy.mount(
      <MoveListWithVariations
        {...defaultProps}
        combinedMoves={combinedMoves}
        combinedMoveDurations={combinedMoveDurations}
      />,
    );

    // Should show move time
    cy.contains("0.5s").should("exist");
  });

  it("opens context menu on right-click", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveListWithVariations {...defaultProps} selectedNodeId="move1" />);

    cy.contains("e4").rightclick();
    // Context menu should appear
    cy.contains("Delete after here").should("exist");
    cy.contains("Promote variation").should("exist");
  });

  it("enables/disables context menu actions correctly", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveListWithVariations {...defaultProps} selectedNodeId="move1" />);

    cy.contains("e4").rightclick();
    // Promote should be enabled for variation
    cy.contains("Promote variation").should("be.disabled");

    // Truncate should be enabled when node has children
    cy.contains("Delete after here").should("not.be.disabled");
  });

  it("calls onSelectNode when move is clicked", () => {
    const defaultProps = createDefaultProps();
    const onSelectNode = defaultProps.onSelectNode;
    cy.mount(<MoveListWithVariations {...defaultProps} onSelectNode={onSelectNode} />);

    cy.contains("e4").click().then(() => {
      expect(onSelectNode).to.have.been.calledWith("move1");
    });
  });

  it("calls onTruncateAfterNode from context menu", () => {
    const defaultProps = createDefaultProps();
    const onTruncate = defaultProps.onTruncateAfterNode;
    cy.mount(<MoveListWithVariations {...defaultProps} selectedNodeId="move1" onTruncateAfterNode={onTruncate} />);

    cy.contains("e4").rightclick();
    cy.contains("Delete after here").click().then(() => {
      expect(onTruncate).to.have.been.calledWith("move1");
    });
  });

  it("shows player names in header", () => {
    const defaultProps = createDefaultProps();
    cy.mount(<MoveListWithVariations {...defaultProps} />);
    cy.contains("Player1").should("exist");
    cy.contains("Player2").should("exist");
    cy.contains("Player3").should("exist");
    cy.contains("Player4").should("exist");
  });
});
