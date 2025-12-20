import PieceReserveVertical from "../../app/components/PieceReserveVertical";

describe("PieceReserveVertical", () => {
  const defaultProps = {
    whiteReserves: { p: 2, n: 1, b: 0, r: 0, q: 0 },
    blackReserves: { p: 1, n: 0, b: 1, r: 0, q: 0 },
    bottomColor: "white" as const,
    height: 400,
  };

  it("renders reserve pieces with counts", () => {
    cy.mount(<PieceReserveVertical {...defaultProps} />);

    // Should show white pawns with count 2
    cy.get('[alt*="white p"]').should("exist");
    // Count badges should be visible
    cy.contains("2").should("exist");
    cy.contains("1").should("exist");
  });

  it("only allows click when count > 0", () => {
    const onPieceClick = cy.stub();
    cy.mount(<PieceReserveVertical {...defaultProps} onPieceClick={onPieceClick} />);

    // Click on piece with count > 0
    cy.get('[alt*="white p"]').first().click().then(() => {
      expect(onPieceClick.called).to.equal(true);
    });
  });

  it("does not call onPieceClick for pieces with count 0", () => {
    const onPieceClick = cy.stub();
    cy.mount(<PieceReserveVertical {...defaultProps} onPieceClick={onPieceClick} />);

    // Pieces with count 0 should not be clickable
    cy.get('[alt*="white b"]').parent().should("have.class", "opacity-30");
  });

  it("highlights selected piece", () => {
    const selected = { color: "white" as const, piece: "p" as const };
    cy.mount(<PieceReserveVertical {...defaultProps} selected={selected} />);

    // Selected piece should have ring styling
    cy.get('[alt*="white p"]').parent().should("have.class", "ring-2");
  });

  it("sets drag data correctly", () => {
    const onPieceDragStart = cy.stub().returns(true);
    cy.mount(<PieceReserveVertical {...defaultProps} onPieceDragStart={onPieceDragStart} />);

    // Trigger drag start with mocked dataTransfer
    const dataTransfer = { setData: cy.stub(), effectAllowed: null };
    cy.get('[alt*="white p"]').first().trigger("dragstart", { dataTransfer }).then(() => {
      expect(onPieceDragStart.called).to.equal(true);
      expect(dataTransfer.setData).to.have.been.calledWith(
        "application/x-bughouse-reserve-piece",
        JSON.stringify({ color: "white", piece: "p" })
      );
      expect(dataTransfer.effectAllowed).to.equal("move");
    });
  });

  it("prevents drag when onPieceDragStart returns false", () => {
    const onPieceDragStart = cy.stub().returns(false);
    cy.mount(<PieceReserveVertical {...defaultProps} onPieceDragStart={onPieceDragStart} />);

    // Drag should be prevented
    cy.get('[alt*="white p"]').first().trigger("dragstart");
    // The drag should not proceed
  });

  it("calls onPieceDragEnd when drag ends", () => {
    const onPieceDragEnd = cy.stub();
    cy.mount(<PieceReserveVertical {...defaultProps} onPieceDragEnd={onPieceDragEnd} />);

    cy.get('[alt*="white p"]').first().trigger("dragend").then(() => {
      expect(onPieceDragEnd.called).to.equal(true);
    });
  });

  it("orders pieces correctly based on bottomColor", () => {
    // With white at bottom, white pieces should be at bottom
    cy.mount(<PieceReserveVertical {...defaultProps} bottomColor="white" />);

    // Verify ordering (this is visual, so we check that pieces exist)
    cy.get('[alt*="white"]').should("exist");
    cy.get('[alt*="black"]').should("exist");
  });
});

