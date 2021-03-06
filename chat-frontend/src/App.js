import React, { Component, Fragment } from "react";
import { io } from "socket.io-client";
import Alert from "./components/Alert";
import Peer from "peerjs";
let host = `http://${document.location.hostname}:8000/`;
let socket = io(host);
export default class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      call_timeout:9000,//(mili second)
      call_cut_timeout_id:"",
      audio_status: true,
      video_status: true,
      call: null,
      peer: null,
      stream: null,
      call_btn_disabled: true,
      is_calling_one: false,
      is_calling_two: false,
      recepient: "",
      my_name: "",
      other_name: "",
      alertContent: <></>,
      my_form_disable: false,
      other_form_disable: true,
    };
    this.owndata = React.createRef();
    this.otherdata = React.createRef();
  }

  connect = () => {
    // sending auser name to the server
    this.setState({
      alertContent: (
        <Alert
          type="warning"
          symbol="Waiting"
          text="Please wait for the server reply"
        />
      ),
      my_form_disable: true,
    });

    // initating a peer
    const peer = new Peer(this.state.my_name, {
      path: "/chat",
      host: "/",
      port: 8000,
    });
    this.setState({ peer: peer });

    // sending the username to the server
    socket.emit("username_submit", { username: this.state.my_name });

    // waiing for any call
    peer.on("call", (call) => {
      this.setState({
        call: call,
        is_calling_one: true,
        other_form_disable: true,
      });
    });
  };

  handleField = (event) => {
    this.setState({
      [event.target.name]: event.target.value,
    });
  };

  // on or off my video
  change_video = () => {
    if (this.state.video_status === true) {
      this.setState({ video_status: false });
      this.state.stream.getVideoTracks()[0].enabled = false;
    }
    if (this.state.video_status === false) {
      this.setState({ video_status: true });
      this.state.stream.getVideoTracks()[0].enabled = true;
    }
  };

  // on or off my audio
  change_audio = () => {
    if (this.state.audio_status === true) {
      this.setState({ audio_status: false });
      this.state.stream.getAudioTracks()[0].enabled = false;
    }
    if (this.state.audio_status === false) {
      this.setState({ audio_status: true });
      this.state.stream.getAudioTracks()[0].enabled = true;
    }
  };

  call_user = () => {
    // sendig data to the server so that the server could send the notofication about call to the peer
    this.setState({
      alertContent: (
        <Alert
          type="warning"
          symbol="Waiting"
          text="seaching for the username ."
        />
      ),
      other_form_disable: true,
    });

    socket.emit("call_user", {
      my_username: this.state.my_name,
      other_username: this.state.other_name,
    });
  };

  answer_call = () => {
    this.setState({
      is_calling_one: false,
      is_calling_two: false,
      call_btn_disabled: false,
      other_form_disable: true,
      alertContent: (
        <Alert type="success" symbol="Call" text="Accepted the call" />
      ),
    });
    // send message to the caller that the receiver accepted the call
    socket.emit("call_accept", {
      other_username: this.state.other_name,
    });

    // answer the call with media stream
    this.state.call.answer(this.state.stream);

    // listenning for the streaming data of the caller
    this.state.call.on("stream", (stream) => {
      this.otherdata.current.srcObject = stream;
    });

    // if the caller cut the call
    this.state.call.on("close", () => {
      this.setState({
        alertContent: <Alert type="danger" symbol="End" text="Call is ended" />,
        other_form_disable: false,
        call_btn_disabled: true,
      });
    });
  };

  cut_call = () => {
    // closing the call
    this.state.call.close();
    let emit_event;
    if (
      this.state.is_calling_two === true &&
      this.state.is_calling_one === true
    ) {
      emit_event = "call_reject";
    } else {
      clearTimeout(this.state.call_cut_timeout_id)
      emit_event = "call_end";
    }

    this.setState({
      other_form_disable: false,
      call_btn_disabled: true,
      is_calling_one: false,
      is_calling_two: false,
      alertContent: (
        <Alert type="danger" symbol="Call" text="Call is ended" />
      ),
    });

    // sending message to caller that the call is ended
    socket.emit(emit_event, {
      other_username: this.state.other_name,
    });
  };

  componentDidMount = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        this.setState({ stream: stream });
        this.owndata.current.srcObject = this.state.stream;
      })
      .catch((err) => {
        this.setState({
          alertContent: <Alert type="danger" symbol="Error" text={err} />,
          my_form_disable:true,
          other_form_disable:true,
          audio_status:false,
          video_status:false,
        })
      });

    // getting information about the username which user has submitted
    socket.on("username_submit", (data) => {
      let code = data.code;
      if (code === "3000") {
        this.setState({
          alertContent: (
            <Alert
              type="danger"
              symbol="Username error"
              text="Username is already exist , choose another ."
            />
          ),
          my_form_disable: false,
        });
      }
      if (code === "2000") {
        this.setState({
          alertContent: (
            <Alert
              type="success"
              symbol="Connect success"
              text="Connection is successfully established . You can chat now"
            />
          ),
          my_form_disable: true,
          other_form_disable: false,
        });
      }
    });

    socket.on("call_user", (data) => {
      let code = data.code;

      // getting verification about the other username
      if (code === "2001") {
        this.setState({
          alertContent: (
            <Alert type="success" symbol="Calling" text="Calling the user" />
          ),
          call_btn_disabled:false
        });
        let other_username = data.other_username;

        // call the peer
        const call = this.state.peer.call(other_username, this.state.stream);
        this.setState({ call: call });

        let call_cut_id=setTimeout(()=>{
          this.state.call.close()
          this.setState({
            alertContent: (
              <Alert
                type="danger"
                symbol="Not answering"
                text={`${this.state.other_name} is not answering your call`}
              />
            ),
            other_form_disable: false,
            call_btn_disabled: true,
          });
           socket.emit("call_end", {
             other_username: this.state.other_name,
           });
        },this.state.call_timeout)

        this.setState({call_cut_timeout_id:call_cut_id})

        this.state.call.on("stream", (remoteStream) => {
          this.otherdata.current.srcObject = remoteStream;
        });

        // if the caller cut the call
        this.state.call.on("close", () => {
          this.setState({
            alertContent: (
              <Alert type="danger" symbol="End" text="Call is ended" />
            ),
            other_form_disable: false,
            call_btn_disabled: true,
          });
        });
      }

      // if anyone calling me
      if (code === "2002") {
        this.setState({
          other_name: data.other_username,
          is_calling_two: true,
          other_form_disable: true,
          alertContent:<></>
        });
      }

      // if the other username is not founded the server
      if (code === "3001") {
        this.setState({
          alertContent: (
            <Alert
              type="danger"
              symbol="Not found"
              text="Username is not found"
            />
          ),
          other_form_disable: false,
        });
      }
    });

    // if our peer received our call
    socket.on("call_accept", () => {
      this.setState({
        call_btn_disabled: false,
        other_form_disable: true,
        alertContent: (
          <Alert type="success" symbol="Call" text="Accepted the call" />
        ),
      });
      clearTimeout(this.state.call_cut_timeout_id);
    });

    //if my peer ended mycall
    socket.on("call_end", () => {
      this.setState({
        alertContent: <Alert type="danger" symbol="End" text="Call is ended" />,
        other_form_disable: false,
        call_btn_disabled: true,
        is_calling_one:false,
        is_calling_two:false
      });
    });

    // if my peer rejected my call
    socket.on("call_reject", () => {
      this.setState({
        alertContent: (
          <Alert
            type="danger"
            symbol="Reject"
            text={`${this.state.other_name} is not answering your call`}
          />
        ),
        other_form_disable: false,
        call_btn_disabled: true,
      });
      clearTimeout(this.state.call_cut_timeout_id)
    });
  };
  render() {
    return (
      <Fragment>
        {this.state.alertContent}
        {/*pick up call or not*/}
        {this.state.is_calling_one === true &&
        this.state.is_calling_two === true ? (
          <div className="mt-4 custom-container rounded row navbar-dark bg-dark">
            <div className="col-lg-8 col-11">
              <p className="fs-2 text-light">
                <strong className="fs-2">{this.state.other_name}</strong> is
                calling you .
              </p>
            </div>
            <div className="col-lg-4 col-11">
              <button
                className="col-2 btn btn-primary fs-4 m-1"
                onClick={this.answer_call}
              >
                <i class="fas fa-phone"></i>
              </button>
              <button
                className="col-2 btn btn-danger fs-4 m-1"
                onClick={this.cut_call}
              >
                <i class="fas fa-phone-slash"></i>
              </button>
            </div>
          </div>
        ) : (
          <></>
        )}

        {/*own and other user name form*/}
        <div className="row justify-content-around mt-2 custom-container">
          <div className="col-lg-6 col-11">
            <div class="input-group mb-3">
              <span class="input-group-text" id="basic-addon1">
                Your name
              </span>
              <input
                type="text"
                class="form-control"
                placeholder="Username"
                aria-label="Username"
                aria-describedby="basic-addon1"
                value={this.state.my_name}
                name="my_name"
                onChange={this.handleField}
                disabled={this.state.my_form_disable}
              />
              <button
                className="btn btn-primary fs-4 col-2"
                onClick={this.connect}
                disabled={this.state.my_form_disable}
              >
                <i class="fas fa-plug"></i>
              </button>
            </div>
          </div>

          <div className="col-lg-6 col-11">
            <div class="input-group mb-3">
              <span class="input-group-text" id="basic-addon1">
                Other name
              </span>
              <input
                type="text"
                class="form-control"
                placeholder="Username"
                aria-label="Username"
                aria-describedby="basic-addon1"
                value={this.state.other_name}
                name="other_name"
                onChange={this.handleField}
                disabled={this.state.other_form_disable}
              />
              <button
                className="col-2 btn btn-primary fs-4"
                onClick={this.call_user}
                disabled={this.state.other_form_disable}
              >
                <i class="fas fa-phone"></i>
              </button>
            </div>
          </div>
        </div>

        {/*own stream controller*/}
        <div className="row justify-content-around mt-1 custom-container">
          <button
            className={`col-2 btn ${
              this.state.video_status === true ? "btn-primary" : "btn-danger"
            } fs-2 p-2`}
            onClick={this.change_video}
          >
            <i class="fas fa-video"></i>
          </button>
          <button
            className={`col-2 btn ${
              this.state.audio_status === true ? "btn-primary" : "btn-danger"
            } fs-2 p-2`}
            onClick={this.change_audio}
          >
            <i class="fas fa-volume-up"></i>
          </button>
          <button
            className="col-2 btn btn-primary fs-2 p-2"
            onClick={this.cut_call}
            disabled={this.state.call_btn_disabled}
          >
            <i class="fas fa-phone-slash"></i>
          </button>
        </div>

        {/*own and other user web cam viewer*/}
        <div className="row justify-content-around custom-container mt-2 md-4 custom-video-container">
          <div className="col-lg-4 col-10 rounded p-2 mt-1 custom-video-box">
            <video
              className="custom-video-player"
              ref={this.owndata}
              autoPlay
              muted
            ></video>
          </div>
          <div className="col-lg-4 col-10 rounded p-2 mt-1 custom-video-box">
            <video
              className="custom-video-player"
              ref={this.otherdata}
              autoPlay
            ></video>
          </div>
        </div>
      </Fragment>
    );
  }
}
