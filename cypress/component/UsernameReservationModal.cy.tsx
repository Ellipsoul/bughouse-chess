import { UsernameReservationModal } from "../../app/components/UsernameReservationModal";
import * as usernameService from "../../app/utils/usernameService";

describe("UsernameReservationModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: cy.stub().as("onClose"),
    userId: "test-user-123",
    onSuccess: cy.stub().as("onSuccess"),
  };

  // Store stubs for direct access in tests
  let isUsernameAvailableStub: sinon.SinonStub;
  let reserveUsernameStub: sinon.SinonStub;

  beforeEach(() => {
    // Reset stubs before each test
    isUsernameAvailableStub = cy.stub(usernameService, "isUsernameAvailable").as("isUsernameAvailable");
    reserveUsernameStub = cy.stub(usernameService, "reserveUsername").as("reserveUsername");
  });

  describe("Rendering", () => {
    it("renders modal when open", () => {
      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.contains("h2", "Choose Your Username").should("be.visible");
      cy.get('input[id="username-input"]').should("be.visible");
      cy.contains("button", "Reserve Username").should("be.visible");
      cy.contains("button", "Cancel").should("be.visible");
    });

    it("does not render when closed", () => {
      cy.mount(<UsernameReservationModal {...defaultProps} isOpen={false} />);

      cy.contains("h2", "Choose Your Username").should("not.exist");
    });

    it("shows warning about permanent username", () => {
      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.contains("Your username can only be set once").should("be.visible");
      cy.contains("cannot be changed later").should("be.visible");
    });

    it("shows username requirements", () => {
      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.contains("3-20 characters").should("be.visible");
      cy.contains("Letters, numbers, and underscores only").should("be.visible");
    });
  });

  describe("Input Validation", () => {
    it("shows error for username that is too short", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("ab");

      // Wait for debounce (1 second) + a bit extra
      cy.wait(1200);

      cy.contains("Username must be at least 3 characters").should("be.visible");
    });

    it("shows error for invalid characters", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("user@name!");

      cy.wait(1200);

      cy.contains("Username can only contain letters, numbers, and underscores").should(
        "be.visible",
      );
    });

    it("accepts valid username with underscores", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("valid_user_123");

      cy.wait(1200);

      cy.contains("Username is available!").should("be.visible");
    });
  });

  describe("Availability Checking", () => {
    it("shows loading spinner immediately when typing", () => {
      // Create a promise that doesn't resolve immediately
      isUsernameAvailableStub.returns(new Promise(() => {})); // Never resolves

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("testuser");

      // Spinner should appear immediately (not after debounce)
      cy.get('[aria-label="Checking availability"]').should("be.visible");
      cy.contains("Checking availability...").should("be.visible");
    });

    it("shows available message when username is free", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("available_user");

      cy.wait(1200);

      cy.contains("Username is available!").should("be.visible");
      cy.get('[aria-label="Username available"]').should("be.visible");
    });

    it("shows taken message when username is not available", () => {
      isUsernameAvailableStub.resolves(false);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("taken_user");

      cy.wait(1200);

      cy.contains("This username is already taken").should("be.visible");
      cy.get('[aria-label="Username taken"]').should("be.visible");
    });

    it("debounces availability check (1 second) but shows spinner immediately", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      // Type quickly
      cy.get('input[id="username-input"]').type("test");

      // Spinner should appear immediately for instant feedback
      cy.get('[aria-label="Checking availability"]').should("be.visible");

      cy.wait(500);
      cy.get('input[id="username-input"]').type("user");

      // Should not have called the API yet (still debouncing)
      cy.get("@isUsernameAvailable").should("not.have.been.called");

      // Spinner should still be visible during debounce
      cy.get('[aria-label="Checking availability"]').should("be.visible");

      // Wait for debounce
      cy.wait(1100);

      // Now it should be called once with the full value
      cy.get("@isUsernameAvailable").should("have.been.calledOnce");
      cy.get("@isUsernameAvailable").should("have.been.calledWith", "testuser");
    });
  });

  describe("Submit Flow", () => {
    it("disables submit button when username is not available", () => {
      isUsernameAvailableStub.resolves(false);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("taken");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").should("be.disabled");
    });

    it("enables submit button when username is available", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("available");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").should("not.be.disabled");
    });

    it("calls reserveUsername on submit", () => {
      isUsernameAvailableStub.resolves(true);
      reserveUsernameStub.resolves({ success: true });

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("newuser");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").click();

      cy.get("@reserveUsername").should("have.been.calledWith", "test-user-123", "newuser");
    });

    it("shows loading state while submitting", () => {
      isUsernameAvailableStub.resolves(true);
      reserveUsernameStub.returns(new Promise(() => {})); // Never resolves

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("newuser");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").click();

      cy.contains("button", "Reserving...").should("be.visible");
    });

    it("calls onSuccess and onClose on successful submission", () => {
      isUsernameAvailableStub.resolves(true);
      reserveUsernameStub.resolves({ success: true });

      const onSuccess = cy.stub().as("onSuccessLocal");
      const onClose = cy.stub().as("onCloseLocal");

      cy.mount(
        <UsernameReservationModal
          {...defaultProps}
          onSuccess={onSuccess}
          onClose={onClose}
        />,
      );

      cy.get('input[id="username-input"]').type("NewUser");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").click();

      // Should call onSuccess with normalized (lowercase) username
      cy.get("@onSuccessLocal").should("have.been.calledWith", "newuser");
      cy.get("@onCloseLocal").should("have.been.called");
    });

    it("shows error when username was taken during submit (race condition)", () => {
      isUsernameAvailableStub.resolves(true);
      reserveUsernameStub.resolves({
        success: false,
        reason: "username_taken",
        message: "This username is already taken",
      });

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("raced");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").click();

      cy.contains("This username was just taken").should("be.visible");
    });

    it("shows error when user already has username", () => {
      isUsernameAvailableStub.resolves(true);
      reserveUsernameStub.resolves({
        success: false,
        reason: "user_already_has_username",
        message: "You have already set a username",
      });

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      cy.get('input[id="username-input"]').type("newname");

      cy.wait(1200);

      cy.contains("button", "Reserve Username").click();

      cy.contains("You have already set a username").should("be.visible");
    });
  });

  describe("Modal Interactions", () => {
    it("closes when Cancel button is clicked", () => {
      const onClose = cy.stub().as("onCloseLocal");

      cy.mount(<UsernameReservationModal {...defaultProps} onClose={onClose} />);

      cy.contains("button", "Cancel").click();

      cy.get("@onCloseLocal").should("have.been.called");
    });

    it("closes when X button is clicked", () => {
      const onClose = cy.stub().as("onCloseLocal");

      cy.mount(<UsernameReservationModal {...defaultProps} onClose={onClose} />);

      cy.get('[aria-label="Close modal"]').click();

      cy.get("@onCloseLocal").should("have.been.called");
    });

    it("closes when clicking backdrop", () => {
      const onClose = cy.stub().as("onCloseLocal");

      cy.mount(<UsernameReservationModal {...defaultProps} onClose={onClose} />);

      // Click on the backdrop (the outermost div with role="dialog")
      cy.get('[role="dialog"]').click({ force: true });

      cy.get("@onCloseLocal").should("have.been.called");
    });

    it("closes when pressing Escape key", () => {
      const onClose = cy.stub().as("onCloseLocal");

      cy.mount(<UsernameReservationModal {...defaultProps} onClose={onClose} />);

      cy.get("body").type("{esc}");

      cy.get("@onCloseLocal").should("have.been.called");
    });

    it("resets state when modal reopens", () => {
      isUsernameAvailableStub.resolves(true);

      cy.mount(<UsernameReservationModal {...defaultProps} />);

      // Type something
      cy.get('input[id="username-input"]').type("testuser");

      cy.wait(1200);

      // Remount as closed then open again
      cy.mount(<UsernameReservationModal {...defaultProps} isOpen={false} />);
      cy.mount(<UsernameReservationModal {...defaultProps} isOpen={true} />);

      // Input should be empty
      cy.get('input[id="username-input"]').should("have.value", "");
    });
  });
});
