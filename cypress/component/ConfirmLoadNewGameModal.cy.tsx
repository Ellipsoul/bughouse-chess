import ConfirmLoadNewGameModal from "../../app/components/ConfirmLoadNewGameModal";

describe("ConfirmLoadNewGameModal", () => {
  it("renders nothing when closed", () => {
    cy.mount(
      <ConfirmLoadNewGameModal
        open={false}
        existingLabel="Game 123"
        newGameId="456"
        onConfirm={cy.stub()}
        onCancel={cy.stub()}
      />,
    );

    cy.contains("Load new game?").should("not.exist");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = cy.stub().as("onCancel");
    cy.mount(
      <ConfirmLoadNewGameModal
        open={true}
        existingLabel="Your current analysis"
        newGameId="160407448121"
        onConfirm={cy.stub()}
        onCancel={onCancel}
      />,
    );

    cy.contains("Cancel").click().then(() => {
      expect(onCancel.called).to.equal(true);
    });
  });

  it("calls onConfirm with dontShowAgain=false by default", () => {
    const onConfirm = cy.stub().as("onConfirm");
    cy.mount(
      <ConfirmLoadNewGameModal
        open={true}
        existingLabel="Game 111"
        newGameId="222"
        onConfirm={onConfirm}
        onCancel={cy.stub()}
      />,
    );

    cy.contains("Confirm").click().then(() => {
      expect(onConfirm).to.have.been.calledWith({ dontShowAgain: false });
    });
  });

  it("calls onConfirm with dontShowAgain=true when checkbox is checked", () => {
    const onConfirm = cy.stub().as("onConfirm");
    cy.mount(
      <ConfirmLoadNewGameModal
        open={true}
        existingLabel="Game 111"
        newGameId="222"
        onConfirm={onConfirm}
        onCancel={cy.stub()}
      />,
    );

    cy.contains("Don’t show again").click();
    cy.contains("Confirm").click().then(() => {
      expect(onConfirm).to.have.been.calledWith({ dontShowAgain: true });
    });
  });
});


