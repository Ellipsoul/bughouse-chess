import VariationSelector from "../../app/components/VariationSelector";
import type { VariationSelectorState } from "../../app/components/useAnalysisState";
import type { AnalysisTree } from "../../app/types/analysis";
import { createInitialPositionSnapshot } from "../../app/utils/analysis/applyMove";

describe("VariationSelector", () => {
  const createTreeWithVariations = (): AnalysisTree => {
    const rootPosition = createInitialPositionSnapshot();
    return {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: rootPosition,
          children: ["main1", "var1"],
          mainChildId: "main1",
        },
        main1: {
          id: "main1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: rootPosition,
          children: [],
          mainChildId: null,
        },
        var1: {
          id: "var1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "d4",
            key: "A:normal:d2-d4",
            normal: { from: "d2", to: "d4" },
          },
          position: rootPosition,
          children: [],
          mainChildId: null,
        },
      },
    };
  };

  const defaultSelector: VariationSelectorState = {
    open: true,
    nodeId: "root",
    selectedChildIndex: 0,
  };

  it("renders only when 2+ children exist", () => {
    const tree = createTreeWithVariations();
    const onSelectIndex = cy.stub();
    const onAccept = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={defaultSelector}
        onSelectIndex={onSelectIndex}
        onAccept={onAccept}
        onCancel={onCancel}
      />,
    );

    cy.contains("Choose variation").should("exist");
    cy.contains("e4").should("exist");
    cy.contains("d4").should("exist");
  });

  it("does not render when only 1 child", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: createInitialPositionSnapshot(),
          children: ["main1"],
          mainChildId: "main1",
        },
        main1: {
          id: "main1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: createInitialPositionSnapshot(),
          children: [],
          mainChildId: null,
        },
      },
    };

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={defaultSelector}
        onSelectIndex={cy.stub()}
        onAccept={cy.stub()}
        onCancel={cy.stub()}
      />,
    );

    cy.contains("Choose variation").should("not.exist");
  });

  it("calls onSelectIndex when variation is clicked", () => {
    const tree = createTreeWithVariations();
    const onSelectIndex = cy.stub();
    const onAccept = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={defaultSelector}
        onSelectIndex={onSelectIndex}
        onAccept={onAccept}
        onCancel={onCancel}
      />,
    );

    cy.contains("d4").click().then(() => {
      expect(onSelectIndex).to.have.been.calledWith(1);
    });
  });

  it("calls onAccept when Enter button is clicked", () => {
    const tree = createTreeWithVariations();
    const onSelectIndex = cy.stub();
    const onAccept = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={defaultSelector}
        onSelectIndex={onSelectIndex}
        onAccept={onAccept}
        onCancel={onCancel}
      />,
    );

    cy.contains("Enter").click().then(() => {
      expect(onAccept.called).to.equal(true);
    });
  });

  it("calls onCancel when Cancel is clicked", () => {
    const tree = createTreeWithVariations();
    const onSelectIndex = cy.stub();
    const onAccept = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={defaultSelector}
        onSelectIndex={onSelectIndex}
        onAccept={onAccept}
        onCancel={onCancel}
      />,
    );

    cy.contains("Cancel").click().then(() => {
      expect(onCancel.called).to.equal(true);
    });
  });

  it("highlights selected variation", () => {
    const tree = createTreeWithVariations();
    const selector: VariationSelectorState = {
      open: true,
      nodeId: "root",
      selectedChildIndex: 1, // Select second variation
    };

    cy.mount(
      <VariationSelector
        tree={tree}
        selector={selector}
        onSelectIndex={cy.stub()}
        onAccept={cy.stub()}
        onCancel={cy.stub()}
      />,
    );

    // The selected variation should have active styling
    cy.contains("d4").closest("button").should("have.class", "bg-amber-200/15");
  });
});
