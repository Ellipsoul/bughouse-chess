import DeleteConfirmationModal from "../../app/components/modals/DeleteConfirmationModal";

describe("DeleteConfirmationModal", () => {
  describe("Rendering", () => {
    it("does not render when closed", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={false}
          title="Delete item?"
          message="This action cannot be undone."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]').should("not.exist");
    });

    it("renders modal when open", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete item?"
          message="This action cannot be undone."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]').should("be.visible");
    });

    it("displays title and message", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete shared game?"
          message="This will permanently remove the game."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("Delete shared game?").should("be.visible");
      cy.contains("This will permanently remove the game.").should("be.visible");
    });

    it("displays warning icon", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete item?"
          message="Warning!"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      // AlertTriangle icon should be present
      cy.get("svg").should("exist");
    });

    it("uses custom button text when provided", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Remove?"
          message="Confirm removal."
          confirmText="Yes, Remove"
          cancelText="No, Keep"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Yes, Remove").should("be.visible");
      cy.contains("button", "No, Keep").should("be.visible");
    });

    it("uses default button text when not provided", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm deletion."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Delete").should("be.visible");
      cy.contains("button", "Cancel").should("be.visible");
    });
  });

  describe("Actions", () => {
    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = cy.stub().as("onCancel");

      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={onCancel}
        />,
      );

      cy.contains("button", "Cancel").click();
      cy.get("@onCancel").should("have.been.calledOnce");
    });

    it("calls onConfirm when confirm button is clicked", () => {
      const onConfirm = cy.stub().as("onConfirm");

      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={onConfirm}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Delete").click();
      cy.get("@onConfirm").should("have.been.calledOnce");
    });

    it("calls onCancel when backdrop is clicked", () => {
      const onCancel = cy.stub().as("onCancel");

      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={onCancel}
        />,
      );

      cy.get('[aria-label="Close dialog"]').click({ force: true });
      cy.get("@onCancel").should("have.been.calledOnce");
    });
  });

  describe("Loading State", () => {
    it("shows loading state when isDeleting is true", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          isDeleting={true}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Deleting...").should("be.visible");
    });

    it("disables buttons when deleting", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          isDeleting={true}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Cancel").should("be.disabled");
      cy.contains("button", "Deleting...").should("be.disabled");
    });

    it("disables backdrop click when deleting", () => {
      const onCancel = cy.stub().as("onCancel");

      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          isDeleting={true}
          onConfirm={() => {}}
          onCancel={onCancel}
        />,
      );

      cy.get('[aria-label="Close dialog"]').click({ force: true });
      cy.get("@onCancel").should("not.have.been.called");
    });

    it("does not close on escape when deleting", () => {
      const onCancel = cy.stub().as("onCancel");

      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          isDeleting={true}
          onConfirm={() => {}}
          onCancel={onCancel}
        />,
      );

      cy.get("body").type("{esc}");
      cy.get("@onCancel").should("not.have.been.called");
    });
  });

  describe("Accessibility", () => {
    it("has alertdialog role", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]').should("exist");
    });

    it("has aria-modal attribute", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]').should("have.attr", "aria-modal", "true");
    });

    it("has aria-labelledby pointing to title", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]')
        .should("have.attr", "aria-labelledby", "delete-modal-title");
      cy.get("#delete-modal-title").should("contain", "Delete?");
    });

    it("has aria-describedby pointing to message", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="This is the description."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.get('[role="alertdialog"]')
        .should("have.attr", "aria-describedby", "delete-modal-description");
      cy.get("#delete-modal-description").should("contain", "This is the description.");
    });

    it("focuses cancel button on open (safer default)", () => {
      cy.mount(
        <DeleteConfirmationModal
          open={true}
          title="Delete?"
          message="Confirm."
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );

      cy.contains("button", "Cancel").should("have.focus");
    });
  });
});
