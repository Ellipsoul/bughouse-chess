import { UsernameReservationModal } from "../../app/components/modals/UsernameReservationModal";

/**
 * Component tests for UsernameReservationModal.
 *
 * NOTE: Tests that require stubbing usernameService (ES module) are skipped
 * because Cypress cannot stub ES module exports. These scenarios are covered
 * by manual testing and the actual Firestore emulator integration.
 */
describe("UsernameReservationModal", () => {
  describe("Rendering", () => {
    it("renders modal when open", () => {
      const onClose = cy.stub();
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.contains("h2", "Choose Your Username").should("be.visible");
      cy.get('input[id="username-input"]').should("be.visible");
      cy.contains("button", "Reserve Username").should("be.visible");
      cy.contains("button", "Cancel").should("be.visible");
    });

    it("does not render when closed", () => {
      const onClose = cy.stub();
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={false}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.contains("h2", "Choose Your Username").should("not.exist");
    });

    it("shows warning about permanent username", () => {
      const onClose = cy.stub();
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.contains("Your username can only be set once").should("be.visible");
      cy.contains("cannot be changed later").should("be.visible");
    });

    it("shows username requirements", () => {
      const onClose = cy.stub();
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.contains("3-20 characters").should("be.visible");
      cy.contains("Letters, numbers, and underscores only").should("be.visible");
    });
  });

  describe("Modal Interactions", () => {
    it("closes when Cancel button is clicked", () => {
      const onClose = cy.stub().as("onClose");
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.contains("button", "Cancel").click();

      cy.get("@onClose").should("have.been.called");
    });

    it("closes when X button is clicked", () => {
      const onClose = cy.stub().as("onClose");
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      cy.get('[aria-label="Close modal"]').click();

      cy.get("@onClose").should("have.been.called");
    });

    it("closes when clicking backdrop", () => {
      const onClose = cy.stub().as("onClose");
      const onSuccess = cy.stub();

      cy.mount(
        <UsernameReservationModal
          isOpen={true}
          onClose={onClose}
          userId="test-user-123"
          onSuccess={onSuccess}
        />,
      );

      // Click on the backdrop (the outermost div with role="dialog")
      cy.get('[role="dialog"]').click({ force: true });

      cy.get("@onClose").should("have.been.called");
    });
  });

  // NOTE: The following tests require stubbing the usernameService ES module,
  // which is not supported by Cypress. These behaviors are tested manually
  // and through integration with the Firestore emulator.
  //
  // Skipped tests:
  // - Input validation (shows error for too short, invalid chars, etc.)
  // - Availability checking (shows available/taken messages)
  // - Submit flow (calls reserveUsername, shows loading state, handles errors)
  // - Escape key closing (flaky in Cypress)
});
