// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

library Pairing {
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    struct G1Point {
        uint256 X;
        uint256 Y;
    }

    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint256[2] X;
        uint256[2] Y;
    }

    /*
     * @return The negation of p, i.e. p.plus(p.negate()) should be zero
     */
    function negate(G1Point memory p) internal pure returns (G1Point memory) {
        // The prime q in the base field F_q for G1
        if (p.X == 0 && p.Y == 0) {
            return G1Point(0, 0);
        } else {
            return G1Point(p.X, PRIME_Q - (p.Y % PRIME_Q));
        }
    }

    /*
     * @return r the sum of two points of G1
     */
    function plus(
        G1Point memory p1,
        G1Point memory p2
    ) internal view returns (G1Point memory r) {
        uint256[4] memory input = [
            p1.X, p1.Y,
            p2.X, p2.Y
        ];
        bool success;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }

        require(success, "pairing-add-failed");
    }

    /*
     * @return r the product of a point on G1 and a scalar, i.e.
     *         p == p.scalarMul(1) and p.plus(p) == p.scalarMul(2) for all
     *         points p.
     */
    function scalarMul(G1Point memory p, uint256 s) internal view returns (G1Point memory r) {
        uint256[3] memory input = [p.X, p.Y, s];
        bool success;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }

        require(success, "pairing-mul-failed");
    }

    /* @return The result of computing the pairing check
     *         e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
     *         For example,
     *         pairing([P1(), P1().negate()], [P2(), P2()]) should return true.
     */
    function pairing(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2,
        G1Point memory d1,
        G2Point memory d2
    ) internal view returns (bool) {
        uint256[24] memory input = [
            a1.X, a1.Y, a2.X[0], a2.X[1], a2.Y[0], a2.Y[1],
            b1.X, b1.Y, b2.X[0], b2.X[1], b2.Y[0], b2.Y[1],
            c1.X, c1.Y, c2.X[0], c2.X[1], c2.Y[0], c2.Y[1],
            d1.X, d1.Y, d2.X[0], d2.X[1], d2.Y[0], d2.Y[1]
        ];
        uint256[1] memory out;
        bool success;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 8, input, mul(24, 0x20), out, 0x20)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }

        require(success, "pairing-opcode-failed");
        return out[0] != 0;
    }
}

contract VerifierPOI16 {
    uint256 constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
    using Pairing for *;

    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[18] IC;
    }

    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
          vk.alfa1 = Pairing.G1Point(20491192805390485299153009773594534940189261866228447918068658471970481763042, 9383485363053290200918347156157836566562967994039712273449902621266178545958);
          vk.beta2 = Pairing.G2Point([4252822878758300859123897981450591353533073413197771768651442665752259397132, 6375614351688725206403948262868962793625744043794305715222011528459656738731], [21847035105528745403288232691147584728191162732299865338377159692350059136679, 10505242626370262277552901082094356697409835680220590971873171140371331206856]);
          vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634, 10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531, 8495653923123431417604973247489272438418190587263600148770280649306958101930]);
          vk.delta2 = Pairing.G2Point([16258445052959872988296981012073076874645381251387611373599582024628077119859, 3883363542274602405153049692588842489156331160358300335162658773869074659116], [18553078070769927137452904295096835405465738722076215057600816486566488987763, 3434548737921436104656526288420987497680729427050141392139332864180033816785]);
          
          vk.IC[0] = Pairing.G1Point(200120407407851441086131816263768254332411517651128563952368366760856121450, 9376271547801184650600937014876935001581507947520003623407563424488907564750);
          vk.IC[1] = Pairing.G1Point(6927549812807053254571923236876664772453695271767250270343302342038139952480, 7722165844355319417923603552341184659712769281306132731711677635557851554617);
          vk.IC[2] = Pairing.G1Point(18967957963173450758145387526100357238479400225721504357187425779226114740722, 11705829996457726463521788390974708507808127247584257638122129119864739917498);
          vk.IC[3] = Pairing.G1Point(2980646512863770441545768038749730339579265809773432158314292917688879490632, 19173414455415216661219566457838803973352233345830354309828562867737353786807);
          vk.IC[4] = Pairing.G1Point(15498135414554109560868431337261208582418305632665957746189062369727647794561, 20869181923930322183686319997704815991996401561820960516057641736682514404324);
          vk.IC[5] = Pairing.G1Point(9996493431623413732268370137464918456980406883338620391561374470224381713990, 20171726689088850051623062292049188842741835098958110076346732288313481908691);
          vk.IC[6] = Pairing.G1Point(18038144141788181864893898983294829882911390318552735299473250057027262031847, 18019251009438977019980904595835554835421735080541117552106839753201115732284);
          vk.IC[7] = Pairing.G1Point(21263420376792856268426871708609794046642477395712077662801703701476847013196, 21605304292433835528923492031013599417159800235330069174299070974609589373909);
          vk.IC[8] = Pairing.G1Point(15841346696274364470293133990907950834357648722923664637547899979068031455051, 1468731746565614387360562598789876738066699225043564683711257433433922905833);
          vk.IC[9] = Pairing.G1Point(20678340935766894361113515994173816296064144857728073404209351590718985487796, 20521627825938239138455029048333525293516298463472405410282865156814771125830);
          vk.IC[10] = Pairing.G1Point(11856197473681443131193737783461586178187015130561213776831665920672725391816, 2241385883766897599305257197144931303144617828126155272955729617794740215587);
          vk.IC[11] = Pairing.G1Point(6391459576318617484835153811408854719046383648536761543959122683766494806669, 19826311057185993821874009076538096582058966841591393502685615000484141446237);
          vk.IC[12] = Pairing.G1Point(7251636673863640901822127419378679458780055613240860211795322164930741527067, 16816238345016909402705594819794813108697814483108215520827462201877932132216);
          vk.IC[13] = Pairing.G1Point(18749431458857028741597898268019839274492003104478344058459645068639407754103, 7300757434894378774144775845999541938956385801664140705275309090926373274256);
          vk.IC[14] = Pairing.G1Point(18050282621880049579841007962805061668961253128032711509593292338516267851811, 21299980262594187949289468055435168538172928717204658945186606031207640778152);
          vk.IC[15] = Pairing.G1Point(6389538329541627375713196516570588226945561355103180913627874791174473658120, 13448853591077843472242448872697902639651815131268758188180718851189923447749);
          vk.IC[16] = Pairing.G1Point(4480650809704364739637954329303365502662869349120841399429178758117175761749, 20169356798650746969673997526178272458413497359572388848264064312266809124322);
          vk.IC[17] = Pairing.G1Point(2333625761588645167641428100104017372641815181264218671161606795160714884324, 1256632905664151436434319560680582530687253893946895842870157924335274888657);
    }

    /*
     * @returns Whether the proof is valid given the hardcoded verifying key
     *          above and the public inputs
     */
    function verifyProof(
        bytes memory proof,
        uint256[17] memory input
    ) public view returns (bool) {
        uint256[8] memory p = abi.decode(proof, (uint256[8]));
        for (uint8 i = 0; i < p.length; i++) {
            // Make sure that each element in the proof is less than the prime q
            require(p[i] < PRIME_Q, "verifier-proof-element-gte-prime-q");
        }
        Pairing.G1Point memory proofA = Pairing.G1Point(p[0], p[1]);
        Pairing.G2Point memory proofB = Pairing.G2Point([p[2], p[3]], [p[4], p[5]]);
        Pairing.G1Point memory proofC = Pairing.G1Point(p[6], p[7]);

        VerifyingKey memory vk = verifyingKey();
        // Compute the linear combination vkX
        Pairing.G1Point memory vkX = vk.IC[0];
        for (uint256 i = 0; i < input.length; i++) {
            // Make sure that every input is less than the snark scalar field
            require(input[i] < SNARK_SCALAR_FIELD, "verifier-input-gte-snark-scalar-field");
            vkX = Pairing.plus(vkX, Pairing.scalarMul(vk.IC[i + 1], input[i]));
        }

        return Pairing.pairing(
            Pairing.negate(proofA),
            proofB,
            vk.alfa1,
            vk.beta2,
            vkX,
            vk.gamma2,
            proofC,
            vk.delta2
        );
    }
}

