import PromotionPicker from "../../app/components/board/PromotionPicker";
import type { BughousePromotionPiece } from "../../app/types/analysis";

describe("PromotionPicker", () => {
  const getDefaultProps = () => ({
    board: "A" as const,
    to: "e8" as const,
    side: "white" as const,
    allowed: ["q", "r", "b", "n"] as BughousePromotionPiece[],
    onPick: cy.stub(),
    onCancel: cy.stub(),
  });

  beforeEach(() => {
    // Mock the board element that PromotionPicker looks for
    // We add it to the body so document.getElementById can find it
    cy.document().then((doc) => {
        // Clean up any existing boards
        const existing = doc.getElementById("board-A");
        if (existing) existing.remove();

        const boardEl = doc.createElement("div");
        boardEl.id = "board-A";
        const squareEl = doc.createElement("div");
        squareEl.setAttribute("data-square", "e8");
        // Ensure it has dimensions for getBoundingClientRect
        squareEl.style.width = "50px";
        squareEl.style.height = "50px";
        squareEl.style.position = "absolute";
        squareEl.style.left = "100px";
        squareEl.style.top = "100px";
        boardEl.appendChild(squareEl);
        doc.body.appendChild(boardEl);
    });
  });

  it("renders allowed pieces", () => {
    cy.mount(<PromotionPicker {...getDefaultProps()} />);
    // Should render promotion options
    cy.get('img[alt="Queen"]').should("exist");
    cy.get('img[alt="Rook"]').should("exist");
    cy.get('img[alt="Bishop"]').should("exist");
    cy.get('img[alt="Knight"]').should("exist");
  });

  it("calls onPick when piece is clicked", () => {
    const props = getDefaultProps();
    cy.mount(<PromotionPicker {...props} />);

    cy.get('img[alt="Queen"]').click().then(() => {
      expect(props.onPick).to.be.calledWith("q");
    });
  });

  it("calls onCancel when cancel button is clicked", () => {
    const props = getDefaultProps();

    // Force fallback UI by ensuring no board element exists
    // We need to do this BEFORE mounting
    cy.document().then((doc) => {
        const existingBoard = doc.getElementById("board-A");
        if (existingBoard) {
            existingBoard.remove();
        }
    });

    cy.mount(<PromotionPicker {...props} />);

    cy.contains("Esc").click().then(() => {
      expect(props.onCancel.called).to.equal(true);
    });
  });

  it("renders fallback UI when anchor square not found", () => {
    // Force fallback UI by ensuring no board element exists
    cy.document().then((doc) => {
        const existingBoard = doc.getElementById("board-A");
        if (existingBoard) {
            existingBoard.remove();
        }
    });

    cy.mount(<PromotionPicker {...getDefaultProps()} />);
    // Should still render the picker with fallback positioning
    cy.contains("Promotion").should("exist");
  });

  it("filters allowed pieces correctly", () => {
    cy.mount(<PromotionPicker {...getDefaultProps()} allowed={["q", "r"]} />);
    cy.get('img[alt="Queen"]').should("exist");
    cy.get('img[alt="Rook"]').should("exist");
    cy.get('img[alt="Bishop"]').should("not.exist");
    cy.get('img[alt="Knight"]').should("not.exist");
  });
});
